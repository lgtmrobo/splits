import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Get athlete + token
const { data: athletes } = await sb.from("athletes").select("id").limit(1);
const athleteId = athletes[0].id;
const { data: tok } = await sb.from("strava_tokens").select("*").eq("athlete_id", athleteId).single();

// Refresh if needed
let token = tok.access_token;
if (new Date(tok.expires_at).getTime() - 5*60*1000 < Date.now()) {
  console.log("refreshing token...");
  const r = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
    }),
  });
  const j = await r.json();
  token = j.access_token;
  await sb.from("strava_tokens").update({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: new Date(j.expires_at * 1000).toISOString(),
  }).eq("athlete_id", athleteId);
}

// Fetch one recent activity from Strava directly to see what fields are returned
const r = await fetch("https://www.strava.com/api/v3/activities/18163044006", {
  headers: { Authorization: `Bearer ${token}` },
});
const a = await r.json();
console.log("Activity:", a.name);
console.log("map:", JSON.stringify(a.map, null, 2));
console.log("trainer:", a.trainer);

// Streams
const r2 = await fetch("https://www.strava.com/api/v3/activities/18163044006/streams?keys=time,latlng,heartrate&key_by_type=false", {
  headers: { Authorization: `Bearer ${token}` },
});
console.log("\nStreams response status:", r2.status);
const streams = await r2.json();
console.log("Streams response (first 800):", JSON.stringify(streams).slice(0, 800));

const r3 = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=3", {
  headers: { Authorization: `Bearer ${token}` },
});
const list = await r3.json();
console.log("\nList endpoint:");
for (const a of list) {
  console.log(`  ${a.id} ${a.name}: map=`, JSON.stringify(a.map));
}
