import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync("/Users/1234/Documents/Repos/splits/.env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await sb.from("activities").select("id, name, start_date_local, trainer, manual, summary_polyline").order("start_date", { ascending: false }).limit(10);
if (error) { console.error(error); process.exit(1); }
for (const a of data) {
  console.log(`${a.id}  ${a.start_date_local?.slice(0,10)}  ${a.name}  trainer=${a.trainer}  manual=${a.manual}  polyline=${a.summary_polyline ? `len ${a.summary_polyline.length}` : "NULL"}`);
}
