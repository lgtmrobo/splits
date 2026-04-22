#!/usr/bin/env node
// One-off: shift week-18 short runs from Tue/Thu to Mon/Wed.
// Keeps the existing planned_runs rows (including any completed_activity_id
// matches) and just rewrites their scheduled_date.
// Run once:  node scripts/migrate-week18.mjs

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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const PLAN_NAME = "Surf City 10 Miler Build";

const SHIFTS = [
  { from: "2026-07-28", to: "2026-07-27" }, // Tue → Mon
  { from: "2026-07-30", to: "2026-07-29" }, // Thu → Wed
];

const { data: plan, error: planErr } = await sb
  .from("training_plans")
  .select("id, name")
  .eq("name", PLAN_NAME)
  .maybeSingle();
if (planErr) throw planErr;
if (!plan) {
  console.error(`No plan named "${PLAN_NAME}"`);
  process.exit(1);
}

for (const { from, to } of SHIFTS) {
  const { data: existing } = await sb
    .from("planned_runs")
    .select("id")
    .eq("plan_id", plan.id)
    .eq("scheduled_date", from);
  if (!existing?.length) {
    console.log(`  skip ${from} → ${to} (no row)`);
    continue;
  }
  const { error } = await sb
    .from("planned_runs")
    .update({ scheduled_date: to })
    .eq("plan_id", plan.id)
    .eq("scheduled_date", from);
  if (error) throw error;
  console.log(`  ${from} → ${to}  (${existing.length} row)`);
}

console.log("Done.");
