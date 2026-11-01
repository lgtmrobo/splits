-- One run, several shoes (e.g. a backyard sim: yards 1–3 in one pair, yard 4
-- in another). Strava only allows one gear per activity and our sync
-- overwrites activities.gear_id on every pull, so splits live in their own
-- table. When an activity has segments they replace its gear_id for every
-- shoe calculation (see lib/gear/segments.ts).
create table if not exists public.activity_gear_segments (
  activity_id bigint not null references public.activities(id) on delete cascade,
  seq smallint not null,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  gear_id text not null,
  distance_m numeric not null check (distance_m > 0),
  -- Moving seconds in this segment, from the run's streams when available.
  moving_time_s integer,
  created_at timestamptz not null default now(),
  primary key (activity_id, seq)
);

create index if not exists idx_activity_gear_segments_gear
  on public.activity_gear_segments(gear_id);
create index if not exists idx_activity_gear_segments_athlete
  on public.activity_gear_segments(athlete_id);

alter table public.activity_gear_segments enable row level security;

drop policy if exists activity_gear_segments_select_own on public.activity_gear_segments;
create policy activity_gear_segments_select_own on public.activity_gear_segments
  for select using (athlete_id = public.current_athlete_id());
