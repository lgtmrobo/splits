import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from("activities").select("id, name, start_date_local, gear_id, manual").order("start_date", { ascending: false });
for (const a of data) console.log(`${a.start_date_local?.slice(0,10)}  ${a.name}  gear=${a.gear_id ?? "—"}  manual=${a.manual}`);
