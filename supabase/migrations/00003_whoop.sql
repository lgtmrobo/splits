-- ============================================================
-- Splits — WHOOP integration
-- ============================================================
-- Tokens, daily recovery + cycle (strain), and per-workout zone breakdown.
-- Workouts are matched to Strava activities by start time so each run can
-- show personalized HR zones.

-- ====== WHOOP OAuth tokens ======
create table if not exists public.whoop_tokens (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  whoop_user_id bigint,
  updated_at timestamptz not null default now()
);

-- ====== Daily recovery ======
-- Resting HR, HRV, recovery score, sleep + cycle linkage.
create table if not exists public.whoop_recovery (
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  date date not null,
  cycle_id bigint,
  sleep_id bigint,
  recovery_score numeric,           -- 0–100
  resting_heart_rate numeric,
  hrv_rmssd_milli numeric,
  spo2_percentage numeric,
  skin_temp_celsius numeric,
  user_calibrating boolean default false,
  raw_jsonb jsonb,
  synced_at timestamptz not null default now(),
  primary key (athlete_id, date)
);

create index if not exists idx_whoop_recovery_date
  on public.whoop_recovery(athlete_id, date desc);

-- ====== Daily cycles (strain, daily HR) ======
create table if not exists public.whoop_cycles (
  id bigint primary key,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,
  strain numeric,                   -- 0–21
  kilojoule numeric,
  average_heart_rate numeric,
  max_heart_rate numeric,
  raw_jsonb jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_whoop_cycles_athlete_date
  on public.whoop_cycles(athlete_id, start_at desc);

-- ====== Per-workout zone breakdown (matched to Strava) ======
create table if not exists public.whoop_workouts (
  id bigint primary key,
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

-- ====== RLS ======
alter table public.whoop_tokens enable row level security;
alter table public.whoop_recovery enable row level security;
alter table public.whoop_cycles enable row level security;
alter table public.whoop_workouts enable row level security;

drop policy if exists whoop_recovery_select_own on public.whoop_recovery;
create policy whoop_recovery_select_own on public.whoop_recovery
  for select using (athlete_id = public.current_athlete_id());

drop policy if exists whoop_cycles_select_own on public.whoop_cycles;
create policy whoop_cycles_select_own on public.whoop_cycles
  for select using (athlete_id = public.current_athlete_id());

drop policy if exists whoop_workouts_select_own on public.whoop_workouts;
create policy whoop_workouts_select_own on public.whoop_workouts
  for select using (athlete_id = public.current_athlete_id());

-- whoop_tokens: no select policy (only service-role can read).
