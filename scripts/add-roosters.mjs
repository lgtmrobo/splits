#!/usr/bin/env node
// Add Rooster's Backyard Ultra (Nov 14 2026, Rohr Park, Chula Vista) as an
// upcoming race and swap the Rose Bowl plan's Nov 14 workout for a race day.
// Backyard format: 4.167 mi loop every hour until one runner remains, so
// distance_m is the target yard count, not a fixed course length.
// Run once:  node scripts/add-roosters.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  const raw = readFileSync(envPath, "utf8");
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

const RACE_NAME = "Rooster's Backyard Ultra";
const RACE_DATE = "2026-11-14";
const YARD_M = 6706; // 4.167 mi
const TARGET_YARDS = 6;
const PLAN_NAME = "Rose Bowl Half Marathon Build";

const { data: athlete, error: athleteErr } = await sb
  .from("athletes")
  .select("id")
  .limit(1)
  .single();
if (athleteErr) throw athleteErr;

const { data: existingRace } = await sb
  .from("races")
  .select("id")
  .eq("name", RACE_NAME)
  .eq("race_date", RACE_DATE)
  .maybeSingle();

if (existingRace) {
  console.log(`  race already exists (${existingRace.id})`);
} else {
  const { data, error } = await sb
    .from("races")
    .insert({
      athlete_id: athlete.id,
      name: RACE_NAME,
      race_date: RACE_DATE,
      distance_m: YARD_M * TARGET_YARDS,
      location: "Rohr Park, Chula Vista, CA",
      status: "upcoming",
      notes: `Backyard format: 4.167 mi loop every hour, last one standing. Distance = target of ${TARGET_YARDS} yards (${(TARGET_YARDS * 4.167).toFixed(1)} mi). Hard-packed trail, one gentle hill. Off the waitlist.`,
    })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`  race inserted (${data.id})`);
}

const { data: plan } = await sb
  .from("training_plans")
  .select("id")
  .eq("name", PLAN_NAME)
  .maybeSingle();
if (!plan) {
  console.error(`No plan named "${PLAN_NAME}"`);
  process.exit(1);
}

const { error: runErr } = await sb
  .from("planned_runs")
  .update({
    workout_type: "race",
    target_distance_m: YARD_M * TARGET_YARDS,
    target_pace_s_per_km: null,
    description: `${RACE_NAME} · target ${TARGET_YARDS} yards`,
  })
  .eq("plan_id", plan.id)
  .eq("scheduled_date", RACE_DATE);
if (runErr) throw runErr;
console.log(`  ${RACE_DATE} planned run → race`);

console.log("Done.");
