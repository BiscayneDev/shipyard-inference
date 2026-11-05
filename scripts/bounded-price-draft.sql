-- DRAFT ONLY. No production application or budget grants.
begin;
create table public.inference_price_budgets(principal text primary key,budget_micros bigint not null check(budget_micros>=0),spent_micros bigint not null default 0 check(spent_micros>=0));
create table public.inference_price_quotes(id uuid primary key,principal text not null,digest text not null,revision text not null,expires_at timestamptz not null,max_cost_micros bigint not null check(max_cost_micros>=0),state text not null default 'quoted'check(state in('quoted','reserved','settled','reconcile')),cost_micros bigint check(cost_micros>=0),created_at timestamptz not null default now());
create unique index inference_price_no_repeat on public.inference_price_quotes(principal,digest)where state in('reserved','settled','reconcile');
alter table public.inference_price_budgets enable row level security;alter table public.inference_price_quotes enable row level security;
revoke all on public.inference_price_budgets,public.inference_price_quotes from public,anon,authenticated;
-- Server-derived principal never accepted from a client identity claim.
create function public.inference_price_consume(p_id uuid,p_principal text,p_digest text,p_revision text,p_max bigint)returns boolean language plpgsql security definer set search_path=public as $$
declare b inference_price_budgets;q inference_price_quotes;held bigint;
begin
 select *into b from inference_price_budgets where principal=p_principal for update;
 if not found then return false;end if;
 select *into q from inference_price_quotes where id=p_id for update;
 if not found or q.state<>'quoted'or q.principal is distinct from p_principal or q.digest is distinct from p_digest or q.revision is distinct from p_revision or q.max_cost_micros is distinct from p_max or q.expires_at<=now()then return false;end if;
 if exists(select 1 from inference_price_quotes where principal=p_principal and digest=p_digest and state in('reserved','settled','reconcile'))then return false;end if;
 select coalesce(sum(max_cost_micros),0)into held from inference_price_quotes where principal=p_principal and state in('reserved','reconcile');
 if b.spent_micros+held+q.max_cost_micros>b.budget_micros then return false;end if;
 update inference_price_quotes set state='reserved'where id=q.id;return true;
end;$$;
create function public.inference_price_settle(p_id uuid,p_cost bigint)returns boolean language plpgsql security definer set search_path=public as $$
declare q inference_price_quotes;principal_key text;
begin
 select principal into principal_key from inference_price_quotes where id=p_id;
 perform 1 from inference_price_budgets where principal=principal_key for update;
 select *into q from inference_price_quotes where id=p_id for update;
 if not found or p_cost is null or p_cost<0 or p_cost>q.max_cost_micros then raise exception 'Exact bounded settlement required';end if;
 if q.state='settled'then if q.cost_micros is distinct from p_cost then raise exception 'Conflicting settlement';end if;return false;end if;
 if q.state<>'reserved'then raise exception 'Current reserved quote required';end if;
 update inference_price_budgets set spent_micros=spent_micros+p_cost where principal=q.principal;
 update inference_price_quotes set state='settled',cost_micros=p_cost where id=q.id;return true;
end;$$;
revoke all on function public.inference_price_consume(uuid,text,text,text,bigint),public.inference_price_settle(uuid,bigint)from public,anon,authenticated;
grant execute on function public.inference_price_consume(uuid,text,text,text,bigint),public.inference_price_settle(uuid,bigint)to service_role;
grant select,insert,update on public.inference_price_quotes to service_role;
commit;
