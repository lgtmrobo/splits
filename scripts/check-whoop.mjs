import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: tok } = await sb.from("whoop_tokens").select("athlete_id, expires_at").maybeSingle();
console.log("Token:", tok ? `expires ${tok.expires_at}` : "NONE");

const { data: rec } = await sb.from("whoop_recovery").select("date, resting_heart_rate, hrv_rmssd_milli, recovery_score").order("date", { ascending: false }).limit(5);
console.log(`\nRecovery rows: ${rec?.length ?? 0}`);
for (const r of rec ?? []) console.log(`  ${r.date}  RHR=${r.resting_heart_rate}  HRV=${r.hrv_rmssd_milli}  rec=${r.recovery_score}`);

const { data: cyc } = await sb.from("whoop_cycles").select("id, start_at, strain").order("start_at", { ascending: false }).limit(5);
console.log(`\nCycle rows: ${cyc?.length ?? 0}`);
for (const c of cyc ?? []) console.log(`  ${c.id}  ${c.start_at}  strain=${c.strain}`);

const { data: wo } = await sb.from("whoop_workouts").select("id, start_at, sport_name, strain, matched_activity_id, zone_two_ms").order("start_at", { ascending: false }).limit(10);
console.log(`\nWorkout rows: ${wo?.length ?? 0}`);
for (const w of wo ?? []) console.log(`  ${w.id}  ${w.start_at}  sport=${w.sport_name}  strain=${w.strain}  matched=${w.matched_activity_id}  z2_ms=${w.zone_two_ms}`);
