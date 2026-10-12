#!/usr/bin/env node
// Rework the Rose Bowl build around Rooster's Backyard Ultra (Nov 14 2026):
// backyard sims replace two long runs, a short taper, two weeks of post-race
// recovery, then goal-pace long runs restored in December.
// Also sets the race's A goal (12 yards / 12 h).
// Run once:  node scripts/roosters-plan-update.mjs
// Then:      node scripts/coros-push.mjs resync <dates printed below>

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const PLAN_NAME = "Rose Bowl Half Marathon Build";
const RACE_NAME = "Rooster's Backyard Ultra";
const MI = 1609.344;
const YARD_M = 6706; // 4.167 mi
const A_GOAL_YARDS = 12;

const CHANGES = [
  ["2026-10-17", "long", 3 * YARD_M, "3-yard BYU sim (12.5 mi) · fuel each yard"],
  ["2026-10-31", "long", 4 * YARD_M, "4-yard BYU sim (16.7 mi) · fuel each yard"],
  ["2026-11-02", "tempo", 6 * MI, "6 mi w/ 2 mi @ 8:30"],
  ["2026-11-07", "long", 8 * MI, "8 mi easy · taper"],
  ["2026-11-08", "recovery", 4 * MI, "4 mi recovery"],
  ["2026-11-09", "easy", 5 * MI, "5 mi easy w/ 4×100m strides"],
  ["2026-11-12", "easy", 4 * MI, "4 mi easy · taper"],
  ["2026-11-14", "race", A_GOAL_YARDS * YARD_M, `${RACE_NAME} · A: 12 yards / B: 6–8`],
  ["2026-11-15", "rest", null, "Rest · post-BYU"],
  ["2026-11-16", "rest", null, "Rest · post-BYU"],
  ["2026-11-19", "recovery", 3 * MI, "3 mi very easy · post-BYU"],
  ["2026-11-21", "easy", 5 * MI, "5 mi easy"],
  ["2026-11-22", "recovery", 3 * MI, "3 mi recovery"],
  ["2026-11-23", "easy", 4 * MI, "4 mi easy w/ 4×100m strides"],
  ["2026-11-26", "easy", 5 * MI, "5 mi easy"],
  ["2026-11-28", "long", 10 * MI, "10 mi easy long"],
  ["2026-11-29", "recovery", 4 * MI, "4 mi recovery"],
  ["2026-12-05", "workout", 14 * MI, "14 mi w/ 4 mi @ goal pace"],
  ["2026-12-12", "workout", 15 * MI, "15 mi w/ 5 mi @ goal pace"],
];

const { error: raceErr } = await sb
  .from("races")
  .update({
    distance_m: A_GOAL_YARDS * YARD_M,
    goal_time_s: A_GOAL_YARDS * 3600,
    notes:
      "Backyard format: 4.167 mi loop every hour, last one standing. A goal: 12 yards (50 mi / 12 h). B goal: 6–8 yards (25–33 mi). Hard-packed trail, one gentle hill. Off the waitlist.",
  })
  .eq("name", RACE_NAME)
  .eq("race_date", "2026-11-14");
if (raceErr) throw raceErr;
console.log("  race goal → 12 yards / 12 h");

const { data: plan } = await sb
  .from("training_plans")
  .select("id")
  .eq("name", PLAN_NAME)
  .maybeSingle();
if (!plan) {
  console.error(`No plan named "${PLAN_NAME}"`);
  process.exit(1);
}

for (const [date, type, meters, description] of CHANGES) {
  const { data: row, error: findErr } = await sb
    .from("planned_runs")
    .select("id")
    .eq("plan_id", plan.id)
    .eq("scheduled_date", date)
    .maybeSingle();
  if (findErr) throw findErr;
  const fields = {
    workout_type: type,
    target_distance_m: meters,
    target_duration_s: null,
    target_pace_s_per_km: null,
    description,
  };
  const { error } = row
    ? await sb.from("planned_runs").update(fields).eq("id", row.id)
    : await sb.from("planned_runs").insert({
        ...fields,
        plan_id: plan.id,
        scheduled_date: date,
        completion_status: "scheduled",
      });
  if (error) throw error;
  console.log(`  ${date}  ${row ? "updated" : "inserted"}  ${description}`);
}

console.log(`\nDone. Resync COROS:\n  node scripts/coros-push.mjs resync ${CHANGES.map(([d]) => d).join(" ")}`);
