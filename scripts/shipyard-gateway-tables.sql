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
