-- ============================================================
-- Row-level security
-- ============================================================
-- Every table is locked down to the athlete whose supabase_user_id
-- matches auth.uid(). Tokens + webhook subscription are writable only
-- by the service role (the anon key never touches them).

-- Helper: look up athlete id for the current session user.
create or replace function public.current_athlete_id()
returns uuid
language sql stable security definer
as $$
  select id from public.athletes where supabase_user_id = auth.uid() limit 1
$$;

-- Enable RLS
alter table public.athletes enable row level security;
alter table public.activities enable row level security;
alter table public.activity_streams enable row level security;
alter table public.gear enable row level security;
alter table public.training_plans enable row level security;
alter table public.planned_runs enable row level security;
alter table public.run_analyses enable row level security;
alter table public.races enable row level security;
alter table public.strava_tokens enable row level security;
alter table public.strava_webhook_subscriptions enable row level security;

-- ====== Athletes ======
drop policy if exists athletes_select_own on public.athletes;
create policy athletes_select_own on public.athletes
  for select using (supabase_user_id = auth.uid());

drop policy if exists athletes_update_own on public.athletes;
create policy athletes_update_own on public.athletes
  for update using (supabase_user_id = auth.uid());

-- ====== Activities ======
drop policy if exists activities_select_own on public.activities;
create policy activities_select_own on public.activities
  for select using (athlete_id = public.current_athlete_id());

-- ====== Streams ======
drop policy if exists streams_select_own on public.activity_streams;
create policy streams_select_own on public.activity_streams
  for select using (
    activity_id in (select id from public.activities where athlete_id = public.current_athlete_id())
  );

-- ====== Gear ======
drop policy if exists gear_select_own on public.gear;
create policy gear_select_own on public.gear
  for select using (athlete_id = public.current_athlete_id());

-- ====== Plans ======
drop policy if exists plans_all_own on public.training_plans;
create policy plans_all_own on public.training_plans
  for all using (athlete_id = public.current_athlete_id())
  with check (athlete_id = public.current_athlete_id());

drop policy if exists planned_runs_all_own on public.planned_runs;
create policy planned_runs_all_own on public.planned_runs
  for all using (
    plan_id in (select id from public.training_plans where athlete_id = public.current_athlete_id())
  )
  with check (
    plan_id in (select id from public.training_plans where athlete_id = public.current_athlete_id())
  );

-- ====== Run analyses ======
drop policy if exists analyses_select_own on public.run_analyses;
create policy analyses_select_own on public.run_analyses
  for select using (
    activity_id in (select id from public.activities where athlete_id = public.current_athlete_id())
  );

-- ====== Races ======
drop policy if exists races_all_own on public.races;
create policy races_all_own on public.races
  for all using (athlete_id = public.current_athlete_id())
  with check (athlete_id = public.current_athlete_id());

-- ====== Tokens + webhook subscription (service role only) ======
-- No policies added — with RLS enabled and no policies, non-service-role
-- clients can't read or write these tables. Service-role bypasses RLS.

-- Note: All writes in the app go through the service role (webhook,
-- OAuth callback, cron). The anon/session client only reads data the
-- policies above allow.
