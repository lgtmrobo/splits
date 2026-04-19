-- ============================================================
-- Splits — initial schema
-- ============================================================
-- Multi-tenant-ready, but v1 is single-user. Every query goes
-- through an athlete_id → supabase_user_id join.
--
-- Run with:
--   supabase db push
-- or paste into the SQL editor in the Supabase dashboard.

-- ====== Extensions ======
create extension if not exists "pgcrypto";

-- ====== Athletes ======
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid unique references auth.users(id) on delete cascade,
  strava_athlete_id bigint unique not null,
  email text,
  first_name text,
  last_name text,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ====== Strava OAuth tokens ======
-- Separate table so we never risk leaking tokens on an athlete select.
create table if not exists public.strava_tokens (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz not null default now()
);

-- ====== Activities ======
create table if not exists public.activities (
  id bigint primary key,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  type text not null,
  sport_type text,
  name text,
  start_date timestamptz not null,
  start_date_local timestamptz,
  timezone text,
  distance_m numeric,
  moving_time_s integer,
  elapsed_time_s integer,
  total_elevation_gain_m numeric,
  average_speed_ms numeric,
  max_speed_ms numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  has_heartrate boolean default false,
  average_cadence numeric,
  calories numeric,
  suffer_score integer,
  gear_id text,
  map_id text,
  summary_polyline text,
  trainer boolean default false,
  commute boolean default false,
  manual boolean default false,
  raw_jsonb jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_athlete_date
  on public.activities(athlete_id, start_date desc);
create index if not exists idx_activities_type
  on public.activities(athlete_id, type);
create index if not exists idx_activities_gear
  on public.activities(gear_id);

-- ====== Activity streams (time-series, fetched lazily) ======
create table if not exists public.activity_streams (
  activity_id bigint primary key references public.activities(id) on delete cascade,
  time_data jsonb,
  heartrate_data jsonb,
  latlng_data jsonb,
  altitude_data jsonb,
  velocity_smooth_data jsonb,
  cadence_data jsonb,
  distance_data jsonb,
  grade_smooth_data jsonb,
  fetched_at timestamptz not null default now()
);

-- ====== Gear (shoes) ======
create table if not exists public.gear (
  id text primary key,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  name text,
  brand_name text,
  model_name text,
  description text,
  distance_m numeric default 0,
  retired boolean default false,
  primary_shoe boolean default false,
  nickname text,
  synced_at timestamptz not null default now()
);

-- ====== Races ======
create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  name text not null,
  race_date date not null,
  distance_m numeric not null,
  location text,
  goal_time_s integer,
  status text not null default 'upcoming'
    check (status in ('upcoming','completed','cancelled','dnf')),
  result_activity_id bigint references public.activities(id) on delete set null,
  plan_id uuid,  -- FK added once training_plans exists
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_races_athlete_date
  on public.races(athlete_id, race_date desc);

-- ====== Training plans ======
create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  goal_race_id uuid references public.races(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_training_plans_athlete
  on public.training_plans(athlete_id, active);

-- Close the circular FK
alter table public.races
  drop constraint if exists fk_races_plan;
alter table public.races
  add constraint fk_races_plan
  foreign key (plan_id) references public.training_plans(id) on delete set null;

-- ====== Planned runs ======
create table if not exists public.planned_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  scheduled_date date not null,
  workout_type text not null
    check (workout_type in ('easy','tempo','interval','long','recovery','rest','race','workout')),
  target_distance_m numeric,
  target_duration_s integer,
  target_pace_s_per_km numeric,
  description text,
  notes text,
  completed_activity_id bigint references public.activities(id) on delete set null,
  completion_status text not null default 'scheduled'
    check (completion_status in ('scheduled','completed','missed','skipped')),
  created_at timestamptz not null default now()
);

create index if not exists idx_planned_runs_plan_date
  on public.planned_runs(plan_id, scheduled_date);
create index if not exists idx_planned_runs_completed
  on public.planned_runs(completed_activity_id);

-- ====== AI-generated analyses ======
create table if not exists public.run_analyses (
  activity_id bigint primary key references public.activities(id) on delete cascade,
  model text not null,
  prompt_version text,
  summary text,
  feedback_jsonb jsonb,
  plan_adherence_score numeric,
  tokens_used integer,
  generated_at timestamptz not null default now()
);

-- ====== Strava webhook subscription (single row per app) ======
create table if not exists public.strava_webhook_subscriptions (
  id bigint primary key,
  callback_url text not null,
  verify_token text,
  created_at timestamptz not null default now()
);

-- ====== updated_at trigger for athletes ======
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists athletes_touch on public.athletes;
create trigger athletes_touch
  before update on public.athletes
  for each row execute procedure public.touch_updated_at();
