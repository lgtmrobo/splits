-- Official race result time, distinct from the linked activity's Strava
-- moving_time_s (which can differ by a few seconds from gun/chip time due to
-- GPS auto-pause, watch stop timing, etc). When set, takes priority for
-- display over the linked activity's time.
alter table public.races
  add column if not exists result_time_s integer;
