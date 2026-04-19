-- ============================================================
-- Splits — persist gear retirement threshold
-- ============================================================
-- cap_m was being derived from the gear.description text (heuristic
-- match on "race"/"trail") which made the user-supplied "retire at"
-- field a no-op. Add it as a real column.

alter table public.gear add column if not exists cap_m numeric;
