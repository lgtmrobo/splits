-- Course polyline + elevation for the goal race of a training plan.
-- Polyline is the same encoded format Strava uses on activities, so it
-- decodes through the existing decodePolyline helper.

alter table public.races
  add column if not exists course_polyline text,
  add column if not exists course_elevation_gain_m numeric;
