#!/usr/bin/env node
// Seed the Surf City 10 Miler training plan + race + planned_runs.
// Run once:   node scripts/seed-plan.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const M_PER_MILE = 1609.344;
const mi = (x) => Math.round(x * M_PER_MILE);

// --- Plan definition (extracted from your sheet) ---
const PLAN_NAME = "Surf City 10 Miler Build";
const PLAN_START = "2026-03-29";
const PLAN_END = "2026-08-08";

const RACE = {
  name: "Surf City 10 Miler",
  race_date: "2026-09-20",
  distance_m: mi(10),
  location: "Huntington Beach Pier",
  goal_time_s: 6325, // 10:32/mi avg → 1h 45m 25s for 10 miles
  status: "upcoming",
};

// type: "easy" | "interval" (fartlek) | "long" | "rest"
// status: "completed" for weeks 1–3 (already done per sheet), else "scheduled"
const WEEKS = [
  { wk: 1,  done: true,  tue: ["2026-03-31", 2,   "easy"],    thu: ["2026-04-02", 2,   "easy"],    sat: ["2026-04-04", 3,   "long"], note: "Foundation" },
  { wk: 2,  done: true,  tue: ["2026-04-07", 2,   "easy"],    thu: ["2026-04-09", 2,   "easy"],    sat: ["2026-04-11", 3.5, "long"], note: "Foundation" },
  { wk: 3,  done: true,  tue: ["2026-04-14", 2,   "easy"],    thu: ["2026-04-16", 2,   "easy"],    sat: ["2026-04-18", 4,   "long"], note: "Foundation" },
  { wk: 4,  done: false, tue: ["2026-04-21", 1.5, "easy"],    thu: ["2026-04-23", 1.5, "easy"],    sat: ["2026-04-25", 3,   "long"], note: "Cutback week" },
  { wk: 5,  done: false, tue: ["2026-04-28", 2,   "easy"],    thu: ["2026-04-30", 2.5, "easy"],    sat: ["2026-05-02", 5,   "long"], note: "Building" },
  { wk: 6,  done: false, tue: ["2026-05-05", 2.5, "easy"],    thu: ["2026-05-07", 2.5, "easy"],    sat: ["2026-05-09", 5.5, "long"], note: "Building" },
  { wk: 7,  done: false, tue: ["2026-05-12", 3,   "interval"],thu: ["2026-05-14", 2.5, "easy"],    sat: ["2026-05-16", 6,   "long"], note: "First 6-miler · first fartlek" },
  { wk: 8,  done: false, tue: ["2026-05-19", 2,   "easy"],    thu: ["2026-05-21", 2,   "easy"],    sat: ["2026-05-23", 4.5, "long"], note: "Cutback week" },
  { wk: 9,  done: false, tue: ["2026-05-26", 3,   "interval"],thu: ["2026-05-28", 3,   "easy"],    sat: ["2026-05-30", 7,   "long"], note: "Development" },
  { wk: 10, done: false, tue: ["2026-06-02", 3,   "interval"],thu: ["2026-06-04", 3,   "easy"],    sat: ["2026-06-06", 7.5, "long"], note: "Development" },
  { wk: 11, done: false, tue: ["2026-06-09", 3,   "interval"],thu: ["2026-06-11", 3.5, "easy"],    sat: ["2026-06-13", 8,   "long"], note: "Start skipping Sat KB" },
  { wk: 12, done: false, tue: ["2026-06-16", 2.5, "easy"],    thu: ["2026-06-18", 2.5, "easy"],    sat: ["2026-06-20", 6,   "long"], note: "Cutback week" },
  { wk: 13, done: false, tue: ["2026-06-23", 3,   "interval"],thu: ["2026-06-25", 3.5, "easy"],    sat: ["2026-06-27", 9,   "long"], note: "Get Endorphin Speed 5" },
  { wk: 14, done: false, tue: ["2026-06-30", 3.5, "interval"],thu: ["2026-07-02", 3.5, "easy"],    sat: ["2026-07-04", 9.5, "long"], note: "Peak" },
  { wk: 15, done: false, tue: ["2026-07-07", 3.5, "interval"],thu: ["2026-07-09", 4,   "easy"],    sat: ["2026-07-11", 10,  "long"], note: "Double digits — milestone" },
  { wk: 16, done: false, tue: ["2026-07-14", 3,   "easy"],    thu: ["2026-07-16", 3,   "easy"],    sat: ["2026-07-18", 7.5, "long"], note: "Cutback week" },
  { wk: 17, done: false, tue: ["2026-07-21", 3.5, "interval"],thu: ["2026-07-23", 4,   "easy"],    sat: ["2026-07-25", 11,  "long"], note: "Longest training run · then Vegas" },
  { wk: 18, done: false, tue: ["2026-07-28", 3,   "easy"],    thu: ["2026-07-30", 3,   "easy"],    sat: ["2026-08-01", 8,   "long"], note: "Taper" },
  { wk: 19, done: false, tue: ["2026-08-04", 0,   "rest"],    thu: ["2026-08-06", 0,   "rest"],    sat: ["2026-08-08", 12,  "long"], note: "12-mile goal run · then race day" },
];

function plannedRow(planId, [date, miles, type], note, weekDone) {
  const isRest = type === "rest";
  const status = weekDone && !isRest ? "completed" : "scheduled";
  const description =
    type === "easy"     ? `${miles} mi easy` :
    type === "interval" ? `${miles} mi fartlek` :
    type === "long"     ? `${miles} mi long run` :
    type === "rest"     ? "Rest" : `${miles} mi`;
  return {
    plan_id: planId,
    scheduled_date: date,
    workout_type: type,
    target_distance_m: isRest ? null : mi(miles),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description,
    notes: note || null,
    completion_status: status,
  };
}

async function main() {
  // 1. Find the athlete (single-user app, take the first row).
  const { data: athletes, error: aErr } = await sb.from("athletes").select("id, first_name").limit(1);
  if (aErr) throw aErr;
  if (!athletes?.length) throw new Error("No athlete row — connect Strava first.");
  const athleteId = athletes[0].id;
  console.log(`Seeding for athlete ${athletes[0].first_name ?? "(unnamed)"} ${athleteId}`);

  // 2. Insert race (skip if a race with same name+date exists).
  const { data: existingRace } = await sb
    .from("races")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("name", RACE.name)
    .eq("race_date", RACE.race_date)
    .maybeSingle();

  let raceId;
  if (existingRace) {
    raceId = existingRace.id;
    console.log(`Race exists: ${raceId}`);
  } else {
    const { data: r, error: rErr } = await sb
      .from("races")
      .insert({ athlete_id: athleteId, ...RACE })
      .select("id")
      .single();
    if (rErr) throw rErr;
    raceId = r.id;
    console.log(`Inserted race: ${raceId}`);
  }

  // 3. Insert training plan.
  const { data: existingPlan } = await sb
    .from("training_plans")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("name", PLAN_NAME)
    .maybeSingle();

  let planId;
  if (existingPlan) {
    planId = existingPlan.id;
    console.log(`Plan exists: ${planId}`);
    // Make sure it's linked to the race + still active.
    await sb.from("training_plans").update({ goal_race_id: raceId, active: true }).eq("id", planId);
  } else {
    const { data: p, error: pErr } = await sb
      .from("training_plans")
      .insert({
        athlete_id: athleteId,
        name: PLAN_NAME,
        start_date: PLAN_START,
        end_date: PLAN_END,
        goal_race_id: raceId,
        active: true,
        notes: "Tue/Thu/Sat — 19 weeks. From Google Sheet.",
      })
      .select("id")
      .single();
    if (pErr) throw pErr;
    planId = p.id;
    console.log(`Inserted plan: ${planId}`);
  }

  // 4. Link race back to plan.
  await sb.from("races").update({ plan_id: planId }).eq("id", raceId);

  // 5. Insert all planned_runs.
  const rows = [];
  for (const w of WEEKS) {
    rows.push(plannedRow(planId, w.tue, w.note, w.done));
    rows.push(plannedRow(planId, w.thu, w.note, w.done));
    rows.push(plannedRow(planId, w.sat, w.note, w.done));
  }

  // Wipe + reinsert so re-running the script is safe.
  const { error: delErr } = await sb.from("planned_runs").delete().eq("plan_id", planId);
  if (delErr) throw delErr;
  const { error: insErr, data: inserted } = await sb.from("planned_runs").insert(rows).select("id");
  if (insErr) throw insErr;
  console.log(`Inserted ${inserted?.length ?? 0} planned_runs`);

  // 6. Try to match completed Strava activities by date for weeks 1–3.
  const completedDates = WEEKS.filter((w) => w.done).flatMap((w) => [w.tue[0], w.thu[0], w.sat[0]]);
  if (completedDates.length) {
    const { data: acts } = await sb
      .from("activities")
      .select("id, start_date_local")
      .eq("athlete_id", athleteId)
      .in("type", ["Run", "TrailRun"]);
    const byDate = new Map();
    for (const a of acts ?? []) {
      const d = a.start_date_local?.slice(0, 10);
      if (!d) continue;
      if (!byDate.has(d)) byDate.set(d, Number(a.id));
    }
    let matched = 0;
    for (const date of completedDates) {
      const actId = byDate.get(date);
      if (!actId) continue;
      const { error } = await sb
        .from("planned_runs")
        .update({ completed_activity_id: actId, completion_status: "completed" })
        .eq("plan_id", planId)
        .eq("scheduled_date", date);
      if (!error) matched++;
    }
    console.log(`Matched ${matched}/${completedDates.length} completed runs to Strava activities`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
