-- 090_daily_logs.sql — per-owner daily activity log (additive).
--
-- One row per owner per calendar day. The `daily_log(entry)` tool appends timestamped lines to
-- today's row (one UPSERT on the (owner_id, log_date) unique key), and getDailyLogsForContext reads
-- the last N days to inject a `## Recent activity` block into every Persona system prompt.
--
-- Append-only in spirit: the content column accumulates lines; we never delete rows here. RLS lets an
-- owner read/write only their own rows (defense-in-depth); the server uses the service-role key.

create table if not exists public.pa_daily_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  log_date date not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (owner_id, log_date)
);

-- Read path is "last N days for one owner, newest first" — index the lookup key.
create index if not exists pa_daily_logs_owner_date_idx
  on public.pa_daily_logs (owner_id, log_date desc);

alter table public.pa_daily_logs enable row level security;

-- Owner can see/manage only their own logs. Server writes use the service-role key (bypasses RLS);
-- these policies are defense-in-depth for any owner-context (anon/auth) access.
drop policy if exists pa_daily_logs_owner_select on public.pa_daily_logs;
create policy pa_daily_logs_owner_select on public.pa_daily_logs
  for select using (auth.uid() = owner_id);

drop policy if exists pa_daily_logs_owner_insert on public.pa_daily_logs;
create policy pa_daily_logs_owner_insert on public.pa_daily_logs
  for insert with check (auth.uid() = owner_id);

drop policy if exists pa_daily_logs_owner_update on public.pa_daily_logs;
create policy pa_daily_logs_owner_update on public.pa_daily_logs
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
