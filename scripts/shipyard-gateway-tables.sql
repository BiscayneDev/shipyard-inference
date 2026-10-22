-- Shipyard inference gateway tables (Supabase: Shipyard / cosubulfdmyrhcajfbdg)
-- Mirrors src/gateway/keys.ts, src/tender/credit-store.ts, src/tender/campaign-store.ts.
-- Table names use the shipyard_ prefix (store defaults) to avoid the marketplace `api_keys` collision.

create table if not exists shipyard_api_keys (
  key_hash   text   primary key,
  user_id    text   not null,
  tenant_id  text,
  project_id text,
  wallet     text,
  label      text,
  scopes     jsonb,
  status     text   not null default 'active',
  created_at bigint not null,
  revoked_at bigint
);
create index if not exists shipyard_api_keys_user_idx on shipyard_api_keys (user_id);
create index if not exists shipyard_api_keys_tenant_idx on shipyard_api_keys (tenant_id, project_id);
create index if not exists shipyard_api_keys_status_idx on shipyard_api_keys (status, revoked_at);

create table if not exists shipyard_tender_credits (
  id          bigint generated always as identity primary key,
  account     text   not null,
  amount_usd  double precision not null,
  placement_id text  not null,
  line        text   not null,
  request_id  text   not null,
  at          bigint not null
);
create index if not exists shipyard_tender_credits_account_idx on shipyard_tender_credits (account, at desc);

create table if not exists shipyard_campaigns (
  campaign_id           text   primary key,
  placement_id          text   not null,
  line                  text   not null,
  endpoint_url          text   not null,
  advertiser_wallet     text   not null,
  usdc_per_impression   double precision not null,
  remaining_impressions bigint not null,
  funded_usdc           double precision not null,
  targeting             jsonb  not null default '{}',
  status                text   not null default 'active',
  payment_reference     text,
  paid_signature        text,
  created_at            bigint
);
alter table shipyard_campaigns add column if not exists status            text not null default 'active';
alter table shipyard_campaigns add column if not exists payment_reference text;
alter table shipyard_campaigns add column if not exists paid_signature    text;
alter table shipyard_campaigns add column if not exists created_at        bigint;

-- OAuth connect flow (src/gateway/oauth.ts SupabaseOAuthStore).
-- Service-role only: RLS on, no public policies.
create table if not exists shipyard_oauth_codes (
  code_hash  text    primary key,
  consumed   boolean not null default false,
  expires_at bigint  not null,
  rec        jsonb   not null
);
create index if not exists shipyard_oauth_codes_expires_idx on shipyard_oauth_codes (expires_at);
alter table shipyard_oauth_codes enable row level security;

create table if not exists shipyard_oauth_once (
  k          text    primary key,
  expires_at bigint  not null
);
create index if not exists shipyard_oauth_once_expires_idx on shipyard_oauth_once (expires_at);
alter table shipyard_oauth_once enable row level security;

-- ---------------------------------------------------------------------------
-- Connection budgets (dock_ connections): atomic reserve/settle + ledger.
-- Source: src/gateway/connection-budget.ts (SupabaseConnectionLedgerStore).
-- Flow per billed call: debit (hold, atomic check+reserve) BEFORE serving,
-- settle (spend + one ledger row) AWAITED after, or release (no charge).
-- Idempotency key = 'conn:<keyId>:<requestId>'; retries cannot double-count.
-- Holds count against the budget until settled/released, so concurrent calls
-- cannot overshoot. A hold orphaned by a crash stays reserved (fail-closed);
-- shipyard_connection_drift() reports spent vs ledger, not holds.
-- ---------------------------------------------------------------------------
create table if not exists shipyard_connection_budgets (
  key_id       text primary key,
  budget_usd   numeric not null,
  spent_usd    numeric not null default 0,
  reserved_usd numeric not null default 0,
  updated_at   timestamptz not null default now(),
  constraint shipyard_connection_budgets_nonneg check (spent_usd >= 0 and reserved_usd >= 0)
);
alter table shipyard_connection_budgets enable row level security;

create table if not exists shipyard_connection_holds (
  idempotency_key text primary key,
  key_id          text not null,
  amount_usd      numeric not null check (amount_usd >= 0),
  status          text not null default 'held' check (status in ('held', 'settled', 'released')),
  created_at      timestamptz not null default now(),
  settled_at      timestamptz
);
create index if not exists shipyard_connection_holds_key_idx on shipyard_connection_holds (key_id, status);
alter table shipyard_connection_holds enable row level security;

create table if not exists shipyard_connection_ledger (
  id              bigint generated always as identity primary key,
  key_id          text not null,
  workspace_ref   text,
  request_id      text not null,
  model           text,
  provider        text,
  cost_usd        numeric not null check (cost_usd >= 0),
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);
create index if not exists shipyard_connection_ledger_key_idx on shipyard_connection_ledger (key_id, created_at);
alter table shipyard_connection_ledger enable row level security;

-- Atomic check-and-reserve. Row lock serialises concurrent calls on one key.
create or replace function shipyard_connection_debit(
  p_key_id text, p_amount_usd numeric, p_idempotency_key text, p_budget_usd numeric default 10
)
returns table (allowed boolean, spent numeric, budget numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  b shipyard_connection_budgets%rowtype;
begin
  if p_amount_usd is null or p_amount_usd < 0 then raise exception 'shipyard_connection_debit: amount must be >= 0'; end if;
  insert into shipyard_connection_budgets (key_id, budget_usd) values (p_key_id, p_budget_usd)
    on conflict (key_id) do nothing;
  select * into b from shipyard_connection_budgets where key_id = p_key_id for update;
  -- Retry of a call that already holds: no second reservation.
  if exists (select 1 from shipyard_connection_holds h where h.idempotency_key = p_idempotency_key) then
    return query select true, b.spent_usd, b.budget_usd;
    return;
  end if;
  if b.spent_usd + b.reserved_usd + p_amount_usd > b.budget_usd then
    return query select false, b.spent_usd, b.budget_usd;
    return;
  end if;
  update shipyard_connection_budgets
     set reserved_usd = reserved_usd + p_amount_usd, updated_at = now()
   where key_id = p_key_id;
  insert into shipyard_connection_holds (idempotency_key, key_id, amount_usd)
    values (p_idempotency_key, p_key_id, p_amount_usd);
  return query select true, b.spent_usd, b.budget_usd;
end;
$$;

-- Convert a hold into spend + exactly one ledger row. Idempotent: a settled hold is a no-op.
create or replace function shipyard_connection_settle(
  p_idempotency_key text, p_cost_usd numeric, p_request_id text,
  p_workspace_ref text default null, p_model text default null, p_provider text default null
)
returns table (settled boolean, spent numeric, budget numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  h shipyard_connection_holds%rowtype;
  b shipyard_connection_budgets%rowtype;
begin
  if p_cost_usd is null or p_cost_usd < 0 then raise exception 'shipyard_connection_settle: cost must be >= 0'; end if;
  select * into h from shipyard_connection_holds where idempotency_key = p_idempotency_key for update;
  if not found then raise exception 'shipyard_connection_settle: no hold for %', p_idempotency_key; end if;
  if h.status = 'released' then raise exception 'shipyard_connection_settle: hold % was released', p_idempotency_key; end if;
  select * into b from shipyard_connection_budgets where key_id = h.key_id for update;
  if h.status = 'settled' then
    return query select false, b.spent_usd, b.budget_usd;
    return;
  end if;
  update shipyard_connection_budgets
     set reserved_usd = greatest(reserved_usd - h.amount_usd, 0),
         spent_usd = spent_usd + p_cost_usd,
         updated_at = now()
   where key_id = h.key_id
  returning * into b;
  insert into shipyard_connection_ledger (key_id, workspace_ref, request_id, model, provider, cost_usd, idempotency_key)
    values (h.key_id, p_workspace_ref, p_request_id, p_model, p_provider, p_cost_usd, p_idempotency_key)
    on conflict (idempotency_key) do nothing;
  update shipyard_connection_holds set status = 'settled', settled_at = now()
   where idempotency_key = p_idempotency_key;
  return query select true, b.spent_usd, b.budget_usd;
end;
$$;

-- Release a hold for a call that was not billed or failed before serving.
create or replace function shipyard_connection_release(p_idempotency_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h shipyard_connection_holds%rowtype;
begin
  select * into h from shipyard_connection_holds where idempotency_key = p_idempotency_key for update;
  if not found or h.status <> 'held' then return false; end if;
  update shipyard_connection_budgets
     set reserved_usd = greatest(reserved_usd - h.amount_usd, 0), updated_at = now()
   where key_id = h.key_id;
  update shipyard_connection_holds set status = 'released', settled_at = now()
   where idempotency_key = p_idempotency_key;
  return true;
end;
$$;

-- Reconciliation: counter vs sum of ledger rows. drift <> 0 means investigate.
create or replace function shipyard_connection_drift(p_key_id text)
returns table (key_id text, spent numeric, ledger_sum numeric, drift numeric, reserved numeric)
language sql
security definer
set search_path = public
as $$
  select b.key_id,
         b.spent_usd,
         coalesce((select sum(l.cost_usd) from shipyard_connection_ledger l where l.key_id = b.key_id), 0),
         b.spent_usd - coalesce((select sum(l.cost_usd) from shipyard_connection_ledger l where l.key_id = b.key_id), 0),
         b.reserved_usd
    from shipyard_connection_budgets b
   where b.key_id = p_key_id;
$$;

revoke all on function shipyard_connection_debit(text, numeric, text, numeric) from public, anon, authenticated;
revoke all on function shipyard_connection_settle(text, numeric, text, text, text, text) from public, anon, authenticated;
revoke all on function shipyard_connection_release(text) from public, anon, authenticated;
revoke all on function shipyard_connection_drift(text) from public, anon, authenticated;
grant execute on function shipyard_connection_debit(text, numeric, text, numeric) to service_role;
grant execute on function shipyard_connection_settle(text, numeric, text, text, text, text) to service_role;
grant execute on function shipyard_connection_release(text) to service_role;
grant execute on function shipyard_connection_drift(text) to service_role;
grant select, insert, update on shipyard_connection_budgets, shipyard_connection_holds, shipyard_connection_ledger to service_role;
