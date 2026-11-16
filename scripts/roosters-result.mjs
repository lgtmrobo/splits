#!/usr/bin/env node
// Rooster's is done (Nov 14 2026, 10 yards). Mark the race completed and
// linked to its activity, and split the run across the three shoes it was
// run in: yards 1–2 Agravic, 3–5 Triumph, 6–10 Vomero. Yards are split
// evenly over the GPS distance, then shoe totals are recomputed the same way
// recomputeGearTotals() does.
// Run once:  node --experimental-strip-types scripts/roosters-result.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  gearShares,
  groupSegmentsByActivity,
  segmentMovingTimes,
} from "../lib/gear/segments.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const RACE_ID = "cb76ec8f-cfa8-4ca1-b254-94bcf65becbe";
const ACTIVITY_ID = 20992126976;
const YARDS = [
  ["g34586801", 2], // Adidas Terrex Agravic SL
  ["g30447967", 3], // Saucony Triumph 22
  ["g33705094", 5], // Nike Vomero Plus
];

const { data: act, error: actErr } = await sb
  .from("activities")
  .select("id, athlete_id, distance_m, moving_time_s")
  .eq("id", ACTIVITY_ID)
  .single();
if (actErr) throw actErr;
const athleteId = act.athlete_id;
const totalM = Number(act.distance_m);
const totalYards = YARDS.reduce((a, [, y]) => a + y, 0);
const segmentM = YARDS.map(([, y]) => Math.round(((totalM * y) / totalYards) * 10) / 10);

const { data: streams } = await sb
  .from("activity_streams")
  .select("distance_data, time_data, velocity_smooth_data")
  .eq("activity_id", ACTIVITY_ID)
  .maybeSingle();
const times = segmentMovingTimes(segmentM, streams ?? null, Number(act.moving_time_s));

const { error: segErr } = await sb.from("activity_gear_segments").upsert(
  YARDS.map(([gearId], i) => ({
    activity_id: ACTIVITY_ID,
    seq: i,
    athlete_id: athleteId,
    gear_id: gearId,
    distance_m: segmentM[i],
    moving_time_s: times[i],
  })),
  { onConflict: "activity_id,seq" }
);
if (segErr) throw segErr;
YARDS.forEach(([gearId, y], i) =>
  console.log(`  ${gearId}  ${y} yd  ${(segmentM[i] / 1609.344).toFixed(2)} mi  ${times[i]}s`)
);

const { error: raceErr } = await sb
  .from("races")
  .update({ status: "completed", result_activity_id: ACTIVITY_ID })
  .eq("id", RACE_ID);
if (raceErr) throw raceErr;
console.log("  Rooster's → completed");

// Recompute shoe odometers (baseline + credited activity meters).
const [{ data: gear, error: gErr }, { data: acts, error: aErr }, { data: segs, error: sErr }] =
  await Promise.all([
    sb.from("gear").select("id, name, baseline_m, distance_m").eq("athlete_id", athleteId),
    sb.from("activities").select("id, gear_id, distance_m, moving_time_s").eq("athlete_id", athleteId),
    sb
      .from("activity_gear_segments")
      .select("activity_id, seq, gear_id, distance_m, moving_time_s")
      .eq("athlete_id", athleteId),
  ]);
if (gErr || aErr || sErr) throw gErr ?? aErr ?? sErr;
const byActivity = groupSegmentsByActivity(segs ?? []);
const sums = new Map();
for (const a of acts ?? []) {
  for (const s of gearShares({ ...a, gear_segments: byActivity.get(Number(a.id)) }))
    sums.set(s.gear_id, (sums.get(s.gear_id) ?? 0) + s.distance_m);
}
for (const g of gear ?? []) {
  const next = Number(g.baseline_m ?? 0) + (sums.get(g.id) ?? 0);
  if (Math.round(next) === Math.round(Number(g.distance_m ?? 0))) continue;
  const { error } = await sb.from("gear").update({ distance_m: next }).eq("id", g.id);
  if (error) throw error;
  console.log(`  ${g.name}: ${(g.distance_m / 1609.344).toFixed(1)} → ${(next / 1609.344).toFixed(1)} mi`);
}
console.log("Done.");
