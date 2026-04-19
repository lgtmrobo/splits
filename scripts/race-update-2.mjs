import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: athletes } = await sb.from("athletes").select("id").limit(1);
const { error } = await sb.from("races")
  .update({ goal_time_s: 7500 })
  .eq("athlete_id", athletes[0].id)
  .eq("name", "Rose Bowl Half Marathon");
if (error) throw error;
console.log("Rose Bowl Half goal → 2:05:00");
