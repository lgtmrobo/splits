#!/usr/bin/env node
// Mark Jul 29 / 30 / 31 as Vegas on the plan calendar.
// Wed 7-29 already has a run; we just append "· Vegas" to the description.
// Thu 7-30 and Fri 7-31 get inserted as rest rows tagged "Vegas".
// Run once:  node scripts/add-vegas.mjs

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

const { data: plan } = await sb
  .from("training_plans")
  .select("id")
  .eq("name", PLAN_NAME)
  .maybeSingle();
if (!plan) {
  console.error(`No plan named "${PLAN_NAME}"`);
  process.exit(1);
}

// Wed 7-29: append Vegas to existing run description.
const { data: wed } = await sb
  .from("planned_runs")
  .select("id, description")
  .eq("plan_id", plan.id)
  .eq("scheduled_date", "2026-07-29")
  .maybeSingle();
if (wed) {
  const already = /vegas/i.test(wed.description ?? "");
  if (!already) {
    const newDesc = `${wed.description ?? ""} · Vegas`.trim();
    await sb.from("planned_runs").update({ description: newDesc }).eq("id", wed.id);
    console.log(`  2026-07-29 → "${newDesc}"`);
  } else {
    console.log(`  2026-07-29 already tagged`);
  }
}

// Thu 7-30, Fri 7-31: insert rest rows with "Vegas".
for (const date of ["2026-07-30", "2026-07-31"]) {
  const { data: existing } = await sb
    .from("planned_runs")
    .select("id")
    .eq("plan_id", plan.id)
    .eq("scheduled_date", date)
    .maybeSingle();
  if (existing) {
    await sb
      .from("planned_runs")
      .update({ workout_type: "rest", description: "Vegas", target_distance_m: null })
      .eq("id", existing.id);
    console.log(`  ${date} updated`);
  } else {
    const { error } = await sb.from("planned_runs").insert({
      plan_id: plan.id,
      scheduled_date: date,
      workout_type: "rest",
      target_distance_m: null,
      target_duration_s: null,
      target_pace_s_per_km: null,
      description: "Vegas",
      notes: "Travel",
      completion_status: "scheduled",
    });
    if (error) throw error;
    console.log(`  ${date} inserted`);
  }
}

console.log("Done.");
