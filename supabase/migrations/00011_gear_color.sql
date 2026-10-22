-- A shoe's color is assigned once and kept while it's active (see
-- lib/gear/colors.ts). Retired shoes give theirs back: a new shoe takes the
-- first palette color no active shoe is using.
alter table public.gear
  add column if not exists color text;
