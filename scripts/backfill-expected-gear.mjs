// One-time backfill: assign expected_gear_id to every planned_runs row using
// the shoe-rotation rule Lucas set — tempo/race-pace work (and actual races)
// go in the Endorphin Speed 5, everything else (easy/recovery/long/interval)
// goes in the Triumph. Rest days get no gear.
//
// Requires supabase/migrations/00008_planned_run_gear.sql to be applied first
// (run it in the Supabase SQL editor — no CLI/DB connection is wired up in
// this repo to apply migrations automatically).
//
// Usage: node scripts/backfill-expected-gear.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const SPEED_5 = "g31087118"; // Saucony Endorphin Speed 5
const TRIUMPH = "g30447967"; // Saucony Triumph 22

function expectedGearFor(workoutType) {
  if (workoutType === "tempo" || workoutType === "workout" || workoutType === "race") {
    return SPEED_5;
  }
  if (workoutType === "rest") return null;
  return TRIUMPH;
}

const { data: runs, error } = await sb
  .from("planned_runs")
  .select("id, workout_type, expected_gear_id");
if (error) throw error;

const byGear = { [SPEED_5]: [], [TRIUMPH]: [], null: [] };
for (const r of runs) {
  const gearId = expectedGearFor(r.workout_type);
  byGear[gearId ?? "null"].push(r.id);
}

for (const [gearId, ids] of Object.entries(byGear)) {
  if (ids.length === 0) continue;
  const value = gearId === "null" ? null : gearId;
  const { error: updateErr } = await sb
    .from("planned_runs")
    .update({ expected_gear_id: value })
    .in("id", ids);
  if (updateErr) throw updateErr;
  console.log(`  ✓ ${ids.length} runs → ${value ?? "(no gear / rest)"}`);
}
console.log(`done: ${runs.length} planned_runs backfilled.`);
