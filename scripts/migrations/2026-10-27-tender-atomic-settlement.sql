-- Apply before deploying the Tender route fix. No chain operations. Default table names only.
-- Holds are deliberately not auto-refunded: unknown chain outcomes require reconciliation.
begin;
create table if not exists public.shipyard_tender_claims (
 id uuid primary key default gen_random_uuid(), account text not null, wallet text not null,
 amount_usd numeric not null check(amount_usd>0), state text not null default 'reserved' check(state in ('reserved','prepared','paid')),
 signature text unique, network text, transaction_identity jsonb, created_at timestamptz not null default now(), confirmed_at timestamptz
);
create unique index if not exists shipyard_tender_one_open_claim on public.shipyard_tender_claims(account) where state <> 'paid';
create table if not exists public.shipyard_tender_routed_receipts(request_id text primary key,account text not null,placement_id text not null,amount_usd numeric not null);
create table if not exists public.shipyard_tender_impression_clock(account text primary key, last_at timestamptz not null);
alter table public.shipyard_tender_routed_receipts enable row level security;
revoke all on public.shipyard_tender_routed_receipts from public,anon,authenticated;
grant select,insert on public.shipyard_tender_routed_receipts to service_role;
alter table public.shipyard_tender_claims enable row level security;
alter table public.shipyard_tender_impression_clock enable row level security;
revoke all on public.shipyard_tender_claims,public.shipyard_tender_impression_clock from public,anon,authenticated;
grant select,insert,update on public.shipyard_tender_claims,public.shipyard_tender_impression_clock to service_role;
create or replace function public.shipyard_tender_reserve_claim(p_account text,p_wallet text,p_min_usd numeric)
returns table(id uuid,account text,wallet text,amount_usd numeric)
language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_amount numeric; v_id uuid;
begin
 if p_account is null or p_wallet is null or p_min_usd is null or p_min_usd<=0 then raise exception 'Invalid claim'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tender-account:'||p_account,0));
 if exists(select 1 from shipyard_tender_claims c where c.account=p_account and c.state<>'paid') then return; end if;
 select floor(coalesce(sum(c.amount_usd),0)::numeric*1000000)/1000000 into v_amount from shipyard_tender_credits c where c.account=p_account;
 if v_amount<p_min_usd then return; end if;
 insert into shipyard_tender_claims(account,wallet,amount_usd) values(p_account,p_wallet,v_amount) returning shipyard_tender_claims.id into v_id;
 insert into shipyard_tender_credits(account,amount_usd,placement_id,line,request_id,at)
 values(p_account,-v_amount,'payout-reservation','claim reserved',v_id::text,floor(extract(epoch from clock_timestamp())*1000));
 return query select v_id,p_account,p_wallet,v_amount;
end $$;
create or replace function public.shipyard_tender_prepare_claim(p_id uuid,p_signature text,p_network text,p_identity jsonb) returns boolean
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if p_signature is null or length(p_signature)<1 or p_network is null or p_network not in ('mainnet','devnet') or p_identity is null or not (p_identity ?& array['signer','mint','blockhash','lastValidBlockHeight']) then raise exception 'Invalid preparation'; end if;
 update shipyard_tender_claims set state='prepared',signature=p_signature,network=p_network,transaction_identity=p_identity where id=p_id and state='reserved';
 return found;
end $$;
create or replace function public.shipyard_tender_confirm_claim(p_id uuid,p_signature text) returns boolean
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update shipyard_tender_claims set state='paid',confirmed_at=now() where id=p_id and state='prepared' and signature=p_signature;
 return found;
end $$;
create or replace function public.shipyard_tender_impression(p_account text,p_min_interval_ms numeric) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare camp shipyard_campaigns%rowtype; v_last timestamptz; v_now timestamptz:=clock_timestamp(); v_share numeric;
begin
 if p_account is null or p_min_interval_ms is null or p_min_interval_ms<0 then raise exception 'Invalid impression'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tender-account:'||p_account,0));
 select last_at into v_last from shipyard_tender_impression_clock where account=p_account;
 if v_last is not null and extract(epoch from (v_now-v_last))*1000<greatest(p_min_interval_ms,5000) then return jsonb_build_object('accrued',0,'throttled',true); end if;
 select * into camp from shipyard_campaigns where coalesce(status,'active')='active' and remaining_impressions>0 and funded_usdc>=usdc_per_impression and usdc_per_impression>0
 order by usdc_per_impression desc,campaign_id for update skip locked limit 1;
 if not found then return jsonb_build_object('accrued',0,'reason','no funded inventory'); end if;
 v_share:=floor(camp.usdc_per_impression::numeric*0.5*1000000)/1000000;
 update shipyard_campaigns set remaining_impressions=remaining_impressions-1,funded_usdc=greatest(0,funded_usdc-usdc_per_impression) where campaign_id=camp.campaign_id;
 insert into shipyard_tender_credits(account,amount_usd,placement_id,line,request_id,at)
 values(p_account,v_share,camp.placement_id,camp.line,gen_random_uuid()::text,floor(extract(epoch from v_now)*1000));
 insert into shipyard_tender_impression_clock(account,last_at) values(p_account,v_now) on conflict(account) do update set last_at=excluded.last_at;
 return jsonb_build_object('accrued',v_share,'line',camp.line,'campaignId',camp.campaign_id);
end $$;
create or replace function public.shipyard_tender_routed_impression(p_account text,p_placement_id text,p_request_id text) returns numeric
language plpgsql security invoker set search_path=public,pg_temp as $$
declare camp shipyard_campaigns%rowtype; v_share numeric;
begin
 if p_account is null or p_placement_id is null or p_request_id is null then raise exception 'Invalid routed impression'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tender-request:'||p_request_id,0));
 if exists(select 1 from shipyard_tender_routed_receipts where request_id=p_request_id) then return 0; end if;
 select * into camp from shipyard_campaigns where placement_id=p_placement_id and coalesce(status,'active')='active' and remaining_impressions>0 and funded_usdc>=usdc_per_impression and usdc_per_impression>0 for update limit 1;
 if not found then return 0; end if;
 v_share:=floor(camp.usdc_per_impression::numeric*0.5*1000000)/1000000;
 update shipyard_campaigns set remaining_impressions=remaining_impressions-1,funded_usdc=greatest(0,funded_usdc-usdc_per_impression) where campaign_id=camp.campaign_id;
 insert into shipyard_tender_credits(account,amount_usd,placement_id,line,request_id,at)
 values(p_account,v_share,camp.placement_id,camp.line,p_request_id,floor(extract(epoch from clock_timestamp())*1000));
 insert into shipyard_tender_routed_receipts(request_id,account,placement_id,amount_usd) values(p_request_id,p_account,p_placement_id,v_share);
 return v_share;
end $$;
revoke all on function public.shipyard_tender_routed_impression(text,text,text) from public,anon,authenticated;
grant execute on function public.shipyard_tender_routed_impression(text,text,text) to service_role;
revoke all on function public.shipyard_tender_reserve_claim(text,text,numeric),public.shipyard_tender_prepare_claim(uuid,text,text,jsonb),public.shipyard_tender_confirm_claim(uuid,text),public.shipyard_tender_impression(text,numeric) from public,anon,authenticated;
grant execute on function public.shipyard_tender_reserve_claim(text,text,numeric),public.shipyard_tender_prepare_claim(uuid,text,text,jsonb),public.shipyard_tender_confirm_claim(uuid,text),public.shipyard_tender_impression(text,numeric) to service_role;
commit;
