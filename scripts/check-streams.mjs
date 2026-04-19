import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await sb.from("activity_streams").select("activity_id, latlng_data, time_data, heartrate_data");
if (error) { console.error(error); process.exit(1); }
console.log(`${data.length} stream rows cached`);
for (const r of data.slice(0, 5)) {
  const ll = Array.isArray(r.latlng_data) ? r.latlng_data.length : "—";
  const hr = Array.isArray(r.heartrate_data) ? r.heartrate_data.length : "—";
  const t = Array.isArray(r.time_data) ? r.time_data.length : "—";
  console.log(`${r.activity_id}  latlng=${ll}  hr=${hr}  time=${t}`);
}
