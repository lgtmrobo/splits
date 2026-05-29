import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync("/Users/1234/Documents/Repos/splits/.env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Most recent runs — the new Coros watch means the latest ones came from it.
const { data, error } = await sb
  .from("activities")
  .select("id, name, start_date_local, type, sport_type, average_heartrate, average_cadence, raw_jsonb")
  .order("start_date", { ascending: false })
  .limit(5);
if (error) { console.error(error); process.exit(1); }

// Fields worth knowing whether Coros pushed through Strava.
const POWER_KEYS = ["device_watts", "average_watts", "weighted_average_watts", "max_watts", "kilojoules"];
const DEVICE_KEYS = ["device_name", "external_id", "upload_id_str"];

for (const a of data) {
  const raw = a.raw_jsonb ?? {};
  console.log(`\n━━━ ${a.id}  ${a.start_date_local?.slice(0, 16)}  "${a.name}"`);
  console.log(`    type=${a.type}/${a.sport_type}  avgHR=${a.average_heartrate ?? "—"}  avgCad=${a.average_cadence ?? "—"}`);
  console.log(`    device:   ${DEVICE_KEYS.map((k) => `${k}=${raw[k] ?? "—"}`).join("  ")}`);
  console.log(`    power:    ${POWER_KEYS.map((k) => `${k}=${raw[k] ?? "—"}`).join("  ")}`);
  console.log(`    all raw_jsonb keys (${Object.keys(raw).length}):`);
  console.log(`      ${Object.keys(raw).sort().join(", ")}`);
}
