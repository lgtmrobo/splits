-- ============================================================
-- Splits — persist running power from device uploads (COROS, etc.)
-- ============================================================
-- COROS running power flows through Strava as the standard watts
-- fields but was only living in activities.raw_jsonb. Promote it to
-- real columns so the activity detail view can surface it.
--   device_watts: true when watts come from a device/power meter,
--   false when Strava estimated them.

alter table public.activities add column if not exists average_watts numeric;
alter table public.activities add column if not exists weighted_average_watts numeric;
alter table public.activities add column if not exists max_watts numeric;
alter table public.activities add column if not exists kilojoules numeric;
alter table public.activities add column if not exists device_watts boolean;

-- Backfill existing rows from the stored raw Strava payload.
update public.activities set
  average_watts          = (raw_jsonb->>'average_watts')::numeric,
  weighted_average_watts = (raw_jsonb->>'weighted_average_watts')::numeric,
  max_watts              = (raw_jsonb->>'max_watts')::numeric,
  kilojoules             = (raw_jsonb->>'kilojoules')::numeric,
  device_watts           = (raw_jsonb->>'device_watts')::boolean
where raw_jsonb ? 'average_watts';
