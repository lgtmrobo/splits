import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync("/Users/1234/Documents/Repos/splits/.env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: athletes } = await sb.from("athletes").select("id").limit(1);
const athleteId = athletes[0].id;

// 1. Update Surf City goal: 1:35 = 5700s
const { error: u } = await sb.from("races")
  .update({ goal_time_s: 5700 })
  .eq("athlete_id", athleteId)
  .eq("name", "Surf City 10 Miler");
if (u) throw u;
console.log("Updated Surf City goal → 1:35");

// 2. Insert Rose Bowl Half if not exists
const { data: existing } = await sb.from("races")
  .select("id")
  .eq("athlete_id", athleteId)
  .eq("name", "Rose Bowl Half Marathon")
  .maybeSingle();
if (existing) {
  console.log("Rose Bowl Half already exists:", existing.id);
} else {
  const { data, error } = await sb.from("races").insert({
    athlete_id: athleteId,
    name: "Rose Bowl Half Marathon",
    race_date: "2027-01-17",
    distance_m: 21097,
    location: "Pasadena, CA",
    status: "upcoming",
  }).select("id").single();
  if (error) throw error;
  console.log("Inserted Rose Bowl Half:", data.id);
}
