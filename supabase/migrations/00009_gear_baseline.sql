-- Manual starting-mileage offset per shoe (e.g. bought used, or Strava won't
-- let the athlete set an odometer). distance_m becomes baseline_m + whatever
-- Strava reports for that gear, recomputed on every sync.
alter table public.gear
  add column if not exists baseline_m numeric not null default 0;
