#!/usr/bin/env node
// Seed Phase A (extends current Surf City plan to race day) and Phase B
// (new Rose Bowl Half Marathon block).
// Idempotent: deletes planned_runs in the date ranges it owns and reinserts.
// Run:  node scripts/seed-phase-a-b.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const root = join(__dirname, "..");
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(join(root, name), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {
      /* file missing — try the next one */
    }
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env.");
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const M_PER_MILE = 1609.344;
const mi = (x) => Math.round(x * M_PER_MILE);

// ---------- Phase A: Surf City Sharpening (Aug 10 – Sept 20) ----------
// Extends the existing "Surf City 10 Miler Build" plan to race day.
// 6 weeks, Tue/Thu/Sat + race Sunday.
const PHASE_A_PLAN_NAME = "Surf City 10 Miler Build";
const PHASE_A_NEW_END = "2026-09-20";
const PHASE_A_RANGE = { start: "2026-08-09", end: "2026-09-20" };

// Race pace = 9:00/mi (1:30:00 goal). Intervals run 20–30 s/mi faster than
// race pace to build speed reserve; tempo work sits at race pace.
const PHASE_A = [
  // A1 — Recovery week after the 12-miler
  ["2026-08-11", 3, "easy",    "3 mi easy"],
  ["2026-08-13", 3, "easy",    "3 mi easy"],
  ["2026-08-15", 6, "long",    "6 mi easy long"],
  // A2 — Intro race-pace
  ["2026-08-18", 4, "interval","4 mi w/ 4×400m @ 8:30 + jog rec"],
  ["2026-08-20", 4, "easy",    "4 mi easy"],
  ["2026-08-22", 8, "workout", "8 mi w/ 3 mi @ race pace (9:00)"],
  // A3
  ["2026-08-25", 5, "tempo",   "5 mi w/ 2×1 mi tempo @ 9:00"],
  ["2026-08-27", 4, "easy",    "4 mi easy"],
  ["2026-08-29", 9, "workout", "9 mi w/ 4 mi @ race pace"],
  // A4 — Peak race rehearsal
  ["2026-09-01", 5, "tempo",   "5 mi w/ 3×1 mi tempo @ 9:00"],
  ["2026-09-03", 4, "easy",    "4 mi easy"],
  ["2026-09-05",10, "workout", "10 mi w/ 5 mi @ race pace"],
  // A5 — Cutback
  ["2026-09-08", 4, "interval","4 mi w/ 4×800 @ 8:30 + jog"],
  ["2026-09-10", 3, "easy",    "3 mi easy"],
  ["2026-09-12", 8, "workout", "8 mi w/ 3 mi @ race pace"],
  // A6 — Race week
  ["2026-09-15", 3, "easy",    "3 mi w/ 4×100m strides"],
  ["2026-09-17", 2, "easy",    "2 mi shakeout"],
  ["2026-09-20",10, "race",    "Surf City 10 Miler"],
];

// ---------- Phase B: Rose Bowl Half Build (Sept 21 2026 – Jan 17 2027) ----
const PHASE_B_PLAN_NAME = "Rose Bowl Half Marathon Build";
const PHASE_B_START = "2026-09-21";
const PHASE_B_END = "2027-01-17";

const ROSE_BOWL_RACE = {
  name: "Rose Bowl Half Marathon",
  race_date: "2027-01-17",
  distance_m: Math.round(13.1094 * M_PER_MILE),
  location: "Rose Bowl, Pasadena, CA",
  goal_time_s: 1 * 3600 + 59 * 60, // sub-2: 1:59:00 at ~9:05/mi
  status: "upcoming",
};

// Goal pace = 9:05/mi (sub-2 half). Tempo sits at race pace; mile reps run
// ~30 s/mi faster (8:35) and 800s ~35 s/mi faster (8:30) to seed VO2max.
const PHASE_B = [
  // B1 — Recovery
  ["2026-09-22", 3, "easy",    "3 mi easy"],
  ["2026-09-24", 3, "easy",    "3 mi easy"],
  ["2026-09-26", 5, "long",    "5 mi easy"],
  // B2 — Base
  ["2026-09-29", 3, "easy",    "3 mi easy"],
  ["2026-10-01", 3, "easy",    "3 mi easy"],
  ["2026-10-03", 6, "long",    "6 mi long run"],
  // B3
  ["2026-10-06", 4, "easy",    "4 mi easy"],
  ["2026-10-08", 4, "easy",    "4 mi easy"],
  ["2026-10-10", 7, "long",    "7 mi long run"],
  // B4
  ["2026-10-13", 4, "easy",    "4 mi easy"],
  ["2026-10-15", 4, "easy",    "4 mi easy"],
  ["2026-10-17", 8, "long",    "8 mi long run"],
  // B5 — Cutback (final Triumph week)
  ["2026-10-20", 3, "easy",    "3 mi easy"],
  ["2026-10-22", 3, "easy",    "3 mi easy"],
  ["2026-10-24", 6, "long",    "6 mi long run"],
  // B6 — Build 1 (Superblast debut)
  ["2026-10-27", 4, "easy",    "4 mi easy"],
  ["2026-10-29", 4, "easy",    "4 mi easy"],
  ["2026-10-31", 9, "long",    "9 mi long run"],
  // B7 — Build 2 (first half-specific tempo)
  ["2026-11-03", 5, "tempo",   "5 mi w/ 3 mi tempo @ 9:05"],
  ["2026-11-05", 4, "easy",    "4 mi easy"],
  ["2026-11-07",10, "long",    "10 mi long run"],
  // B8 — Build 3
  ["2026-11-10", 5, "tempo",   "5 mi w/ 4 mi tempo @ 9:05"],
  ["2026-11-12", 4, "easy",    "4 mi easy"],
  ["2026-11-14",11, "workout", "11 mi, last 2 mi @ goal pace"],
  // B9 — Cutback
  ["2026-11-17", 4, "interval","4 mi w/ 4×800m @ 8:30"],
  ["2026-11-19", 3, "easy",    "3 mi easy"],
  ["2026-11-21", 8, "long",    "8 mi easy long"],
  // B10 — Specific 1
  ["2026-11-24", 6, "tempo",   "6 mi w/ 4 mi tempo @ 9:05"],
  ["2026-11-26", 4, "easy",    "4 mi easy"],
  ["2026-11-28",11, "workout", "11 mi w/ 3 mi @ goal pace"],
  // B11 — Specific 2
  ["2026-12-01", 6, "tempo",   "6 mi w/ 2×2 mi tempo @ 9:05"],
  ["2026-12-03", 5, "easy",    "5 mi easy"],
  ["2026-12-05",12, "workout", "12 mi w/ 4 mi @ goal pace"],
  // B12 — Specific 3
  ["2026-12-08", 6, "tempo",   "6 mi w/ 5 mi continuous tempo @ 9:05"],
  ["2026-12-10", 5, "easy",    "5 mi easy"],
  ["2026-12-12",12, "long",    "12 mi long run easy"],
  // B13 — Cutback
  ["2026-12-15", 4, "interval","4 mi w/ 4×800m @ 8:30"],
  ["2026-12-17", 4, "easy",    "4 mi easy"],
  ["2026-12-19", 8, "long",    "8 mi easy long"],
  // B14 — Peak 1 (longest training run)
  ["2026-12-22", 6, "tempo",   "6 mi w/ 5 mi tempo @ 9:05"],
  ["2026-12-24", 5, "easy",    "5 mi easy"],
  ["2026-12-26",13, "workout", "13 mi w/ 6 mi @ goal pace"],
  // B15 — Peak 2
  ["2026-12-29", 6, "interval","6 mi w/ 3×1 mi @ 8:35"],
  ["2026-12-31", 4, "easy",    "4 mi easy"],
  ["2027-01-02",12, "workout", "12 mi w/ 8 mi @ goal pace"],
  // B16 — Taper 1
  ["2027-01-05", 5, "tempo",   "5 mi w/ 3 mi tempo @ 9:05"],
  ["2027-01-07", 4, "easy",    "4 mi easy"],
  ["2027-01-09", 9, "workout", "9 mi w/ 3 mi @ goal pace"],
  // B17 — Race week
  ["2027-01-12", 4, "easy",    "4 mi w/ 4×100m strides"],
  ["2027-01-14", 3, "easy",    "3 mi shakeout"],
  ["2027-01-17",13.1094,"race","Rose Bowl Half Marathon"],
];

function plannedRow(planId, [date, miles, type, description]) {
  const isRest = type === "rest";
  return {
    plan_id: planId,
    scheduled_date: date,
    workout_type: type,
    target_distance_m: isRest ? null : mi(miles),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description,
    notes: null,
    completion_status: "scheduled",
  };
}

async function main() {
  const { data: athletes, error: aErr } = await sb
    .from("athletes")
    .select("id, first_name")
    .limit(1);
  if (aErr) throw aErr;
  if (!athletes?.length) throw new Error("No athlete row.");
  const athleteId = athletes[0].id;
  console.log(`Athlete: ${athletes[0].first_name} ${athleteId}`);

  // ---------- Phase A: extend the existing Surf City plan ----------
  const { data: surfPlan, error: spErr } = await sb
    .from("training_plans")
    .select("id, end_date")
    .eq("athlete_id", athleteId)
    .eq("name", PHASE_A_PLAN_NAME)
    .maybeSingle();
  if (spErr) throw spErr;
  if (!surfPlan) {
    throw new Error(
      `Surf City plan not found. Run seed-plan.mjs first to create it.`,
    );
  }
  console.log(`Surf City plan: ${surfPlan.id} (end was ${surfPlan.end_date})`);

  await sb
    .from("training_plans")
    .update({ end_date: PHASE_A_NEW_END })
    .eq("id", surfPlan.id);

  // Wipe + reinsert Phase A range so the script is idempotent.
  const { error: delAErr } = await sb
    .from("planned_runs")
    .delete()
    .eq("plan_id", surfPlan.id)
    .gte("scheduled_date", PHASE_A_RANGE.start)
    .lte("scheduled_date", PHASE_A_RANGE.end);
  if (delAErr) throw delAErr;

  const aRows = PHASE_A.map((r) => plannedRow(surfPlan.id, r));
  const { error: insAErr, data: aIns } = await sb
    .from("planned_runs")
    .insert(aRows)
    .select("id");
  if (insAErr) throw insAErr;
  console.log(`Phase A: ${aIns?.length ?? 0} planned_runs inserted`);

  // Re-aim the Surf City race goal at 1:30:00 (9:00/mi) — the sub-2 build
  // logic upstream assumes ambitious goal times, so align the older row too.
  const SURF_CITY_GOAL_S = 1 * 3600 + 30 * 60;
  await sb
    .from("races")
    .update({ goal_time_s: SURF_CITY_GOAL_S })
    .eq("athlete_id", athleteId)
    .eq("name", "Surf City 10 Miler");
  console.log(`Surf City race goal → ${SURF_CITY_GOAL_S}s (1:30:00 @ 9:00/mi)`);

  // ---------- Phase B: new Rose Bowl race + plan ----------
  let { data: rbRace } = await sb
    .from("races")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("name", ROSE_BOWL_RACE.name)
    .eq("race_date", ROSE_BOWL_RACE.race_date)
    .maybeSingle();

  let rbRaceId;
  if (rbRace) {
    rbRaceId = rbRace.id;
    // Keep the row in sync with the constants above so goal/distance/etc.
    // can be updated by editing this file and re-running the seed.
    await sb.from("races").update(ROSE_BOWL_RACE).eq("id", rbRaceId);
    console.log(`Rose Bowl race updated: ${rbRaceId}`);
  } else {
    const { data: r, error: rErr } = await sb
      .from("races")
      .insert({ athlete_id: athleteId, ...ROSE_BOWL_RACE })
      .select("id")
      .single();
    if (rErr) throw rErr;
    rbRaceId = r.id;
    console.log(`Rose Bowl race inserted: ${rbRaceId}`);
  }

  let { data: rbPlan } = await sb
    .from("training_plans")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("name", PHASE_B_PLAN_NAME)
    .maybeSingle();

  let rbPlanId;
  if (rbPlan) {
    rbPlanId = rbPlan.id;
    await sb
      .from("training_plans")
      .update({
        start_date: PHASE_B_START,
        end_date: PHASE_B_END,
        goal_race_id: rbRaceId,
        active: true,
      })
      .eq("id", rbPlanId);
    console.log(`Rose Bowl plan exists: ${rbPlanId}`);
  } else {
    const { data: p, error: pErr } = await sb
      .from("training_plans")
      .insert({
        athlete_id: athleteId,
        name: PHASE_B_PLAN_NAME,
        start_date: PHASE_B_START,
        end_date: PHASE_B_END,
        goal_race_id: rbRaceId,
        active: true,
        notes:
          "17 weeks · Recovery → Base → Build → Specific → Peak → Taper. From sheet.",
      })
      .select("id")
      .single();
    if (pErr) throw pErr;
    rbPlanId = p.id;
    console.log(`Rose Bowl plan inserted: ${rbPlanId}`);
  }

  await sb.from("races").update({ plan_id: rbPlanId }).eq("id", rbRaceId);

  const { error: delBErr } = await sb
    .from("planned_runs")
    .delete()
    .eq("plan_id", rbPlanId);
  if (delBErr) throw delBErr;

  const bRows = PHASE_B.map((r) => plannedRow(rbPlanId, r));
  const { error: insBErr, data: bIns } = await sb
    .from("planned_runs")
    .insert(bRows)
    .select("id");
  if (insBErr) throw insBErr;
  console.log(`Phase B: ${bIns?.length ?? 0} planned_runs inserted`);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
