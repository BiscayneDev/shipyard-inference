-- 2026-09-23: persistent per-project daily spend caps (src/gateway/project-caps.ts).
-- Additive. Rollback: drop function shipyard_spend_add(text, date, numeric); drop table shipyard_spend_windows;

create table if not exists shipyard_spend_windows (
  project_id   text        not null,
  window_start date        not null,
  spent_usd    numeric     not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (project_id, window_start)
);
alter table shipyard_spend_windows enable row level security;

create or replace function shipyard_spend_add(p_project_id text, p_window_start date, p_amount numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  insert into shipyard_spend_windows as w (project_id, window_start, spent_usd, updated_at)
  values (p_project_id, p_window_start, greatest(p_amount, 0), now())
  on conflict (project_id, window_start)
  do update set spent_usd = w.spent_usd + greatest(excluded.spent_usd, 0), updated_at = now()
  returning spent_usd;
$$;
revoke all on function shipyard_spend_add(text, date, numeric) from public, anon, authenticated;
grant execute on function shipyard_spend_add(text, date, numeric) to service_role;
grant select on shipyard_spend_windows to service_role;
notify pgrst, 'reload schema';
