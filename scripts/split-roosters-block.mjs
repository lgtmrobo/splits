#!/usr/bin/env node
// Split the Rose Bowl build into two blocks so the "current block" matches
// the next race: Rooster's Backyard Ultra Build (Sep 21 → Nov 14) and a
// shortened Rose Bowl Half Marathon Build (Nov 15 → Jan 17).
// Run once:  node scripts/split-roosters-block.mjs

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

const ROSE_BOWL_PLAN = "Rose Bowl Half Marathon Build";
const NEW_PLAN = "Rooster's Backyard Ultra Build";
const RACE_NAME = "Rooster's Backyard Ultra";
const SPLIT_START = "2026-09-21";
const RACE_DATE = "2026-11-14";
const ROSE_BOWL_START = "2026-11-15";

const { data: roseBowl, error: rbErr } = await sb
  .from("training_plans")
  .select("*")
  .eq("name", ROSE_BOWL_PLAN)
  .single();
if (rbErr) throw rbErr;

const { data: race, error: raceErr } = await sb
  .from("races")
  .select("id")
  .eq("name", RACE_NAME)
  .eq("race_date", RACE_DATE)
  .single();
if (raceErr) throw raceErr;

let { data: block } = await sb
  .from("training_plans")
  .select("id")
  .eq("name", NEW_PLAN)
  .maybeSingle();
if (!block) {
  const { data, error } = await sb
    .from("training_plans")
    .insert({
      athlete_id: roseBowl.athlete_id,
      name: NEW_PLAN,
      start_date: SPLIT_START,
      end_date: RACE_DATE,
      goal_race_id: race.id,
      active: true,
      notes:
        "8 weeks · Surf City recovery → base → backyard sims (3 & 4 yards) → taper. Split from the Rose Bowl build after getting in off the waitlist.",
    })
    .select("id")
    .single();
  if (error) throw error;
  block = data;
  console.log(`  block inserted (${block.id})`);
} else {
  console.log(`  block already exists (${block.id})`);
}

const { data: moved, error: moveErr } = await sb
  .from("planned_runs")
  .update({ plan_id: block.id })
  .eq("plan_id", roseBowl.id)
  .gte("scheduled_date", SPLIT_START)
  .lte("scheduled_date", RACE_DATE)
  .select("id");
if (moveErr) throw moveErr;
console.log(`  moved ${moved.length} planned runs → ${NEW_PLAN}`);

const { error: rbUpdErr } = await sb
  .from("training_plans")
  .update({
    start_date: ROSE_BOWL_START,
    notes:
      "9 weeks · post-BYU recovery → Build → Specific → Peak → Taper. Originally 17 weeks from Sep 21; first 8 weeks split into the Rooster's block.",
  })
  .eq("id", roseBowl.id);
if (rbUpdErr) throw rbUpdErr;
console.log(`  ${ROSE_BOWL_PLAN} → starts ${ROSE_BOWL_START}`);

const { error: raceUpdErr } = await sb
  .from("races")
  .update({ plan_id: block.id })
  .eq("id", race.id);
if (raceUpdErr) throw raceUpdErr;
console.log("  race linked to block");

console.log("Done.");
