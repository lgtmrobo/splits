#!/usr/bin/env node
// Re-assign expected shoes on the runs roosters-plan-update.mjs changed —
// they kept the shoe of the workout they replaced. Rooster's and its two
// backyard sims go in the Vomero Plus (race shoe); goal-pace work stays in
// the Endorphin Speed 5; rest days get no shoe.
// Run once:  node scripts/fix-roosters-gear.mjs

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

const SPEED_5 = "g31087118"; // Saucony Endorphin Speed 5
const VOMERO = "g33705094"; // Nike Vomero Plus

const ASSIGNMENTS = [
  ["2026-10-17", VOMERO],
  ["2026-10-31", VOMERO],
  ["2026-11-09", VOMERO],
  ["2026-11-14", VOMERO],
  ["2026-11-15", null],
  ["2026-11-16", null],
  ["2026-11-23", VOMERO],
  ["2026-11-28", VOMERO],
  ["2026-12-12", SPEED_5],
];

for (const [date, gearId] of ASSIGNMENTS) {
  const { data, error } = await sb
    .from("planned_runs")
    .update({ expected_gear_id: gearId })
    .eq("scheduled_date", date)
    .select("description");
  if (error) throw error;
  if (!data?.length) {
    console.warn(`  ? ${date} — no planned run found`);
    continue;
  }
  console.log(`  ${date} → ${gearId ?? "(none)"}  ${data[0].description}`);
}
console.log("Done.");
