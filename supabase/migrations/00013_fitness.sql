-- Fitness model inputs (see lib/fitness).
--
-- 1. activities.best_efforts — Strava's fastest 400m/mile/5K/… inside each
--    run. Only the detail endpoint returns them, and the nightly sync
--    upserts list-endpoint payloads over raw_jsonb, so they get their own
--    column that list upserts never touch. NULL = not fetched yet;
--    [] = fetched, none (treadmill, too short).
alter table public.activities add column if not exists best_efforts jsonb;

update public.activities
set best_efforts = raw_jsonb->'best_efforts'
where best_efforts is null
  and jsonb_typeof(raw_jsonb->'best_efforts') = 'array';

create index if not exists idx_activities_best_efforts_missing
  on public.activities(athlete_id, start_date desc)
  where best_efforts is null;

-- 2. Hand-set thresholds. NULL = estimate from data.
alter table public.athletes
  add column if not exists threshold_pace_s_per_km numeric
    check (threshold_pace_s_per_km is null or threshold_pace_s_per_km between 120 and 600),
  add column if not exists lthr integer
    check (lthr is null or lthr between 100 and 220),
  add column if not exists resting_hr integer
    check (resting_hr is null or resting_hr between 25 and 110),
  add column if not exists max_hr integer
    check (max_hr is null or max_hr between 120 and 230);
