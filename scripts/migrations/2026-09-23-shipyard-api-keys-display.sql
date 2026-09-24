-- 2026-09-23: masked key display for developer key management (src/gateway/keys.ts).
-- Additive + nullable: existing keys keep working and show as "sk-shipyard-…".
-- Rollback: alter table shipyard_api_keys drop column if exists key_prefix, drop column if exists last4;
alter table shipyard_api_keys add column if not exists key_prefix text;
alter table shipyard_api_keys add column if not exists last4 text;
create index if not exists shipyard_api_keys_project_created_idx on shipyard_api_keys (project_id, created_at desc);
notify pgrst, 'reload schema';
