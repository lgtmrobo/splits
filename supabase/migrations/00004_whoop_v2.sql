-- ============================================================
-- Splits — WHOOP v2 endpoint compatibility
-- ============================================================
-- v2 recovery + workout endpoints return UUID strings instead of bigints.
-- Convert sleep_id (recovery) + id (workouts) to text. Workouts table has
-- no real data yet, so safe to drop + recreate.

alter table public.whoop_recovery alter column sleep_id type text using sleep_id::text;

drop table if exists public.whoop_workouts cascade;

create table public.whoop_workouts (
  id text primary key,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,
  sport_name text,
  strain numeric,
  average_heart_rate numeric,
  max_heart_rate numeric,
  zone_zero_ms bigint,
  zone_one_ms bigint,
  zone_two_ms bigint,
  zone_three_ms bigint,
  zone_four_ms bigint,
  zone_five_ms bigint,
  matched_activity_id bigint references public.activities(id) on delete set null,
  raw_jsonb jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_whoop_workouts_athlete_date
  on public.whoop_workouts(athlete_id, start_at desc);
create index if not exists idx_whoop_workouts_match
  on public.whoop_workouts(matched_activity_id);

alter table public.whoop_workouts enable row level security;

drop policy if exists whoop_workouts_select_own on public.whoop_workouts;
create policy whoop_workouts_select_own on public.whoop_workouts
  for select using (athlete_id = public.current_athlete_id());
