-- Race type. Triathlons (Ironman 70.3 / full) make the athlete's sync pull
-- in swims and rides as well as runs; run-only views keep filtering to
-- type = 'Run'.
alter table public.races
  add column if not exists race_type text not null default 'run'
    check (race_type in ('run', 'ironman_70_3', 'ironman'));
