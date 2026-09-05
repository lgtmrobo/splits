-- Track which shoe a planned run is expected to be run in, so shoe mileage
-- projections (current + upcoming planned miles through a race date) can be
-- computed directly from the training plan.
alter table public.planned_runs
  add column if not exists expected_gear_id text references public.gear(id) on delete set null;

create index if not exists idx_planned_runs_expected_gear
  on public.planned_runs(expected_gear_id);
