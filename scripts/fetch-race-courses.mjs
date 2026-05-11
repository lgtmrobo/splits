#!/usr/bin/env node
// Pull race course polylines from public Strava routes and stash them on
// the race rows. Run after seed-phase-a-b.mjs.
// Run:  node scripts/fetch-race-courses.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const name of [".env.local", ".env"]) {
  try {
    const raw = readFileSync(name, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* file missing — try the next one */
  }
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const COURSES = [
  {
    raceName: "Surf City 10 Miler",
    routeId: "3332025223805287244",
  },
  {
    raceName: "Rose Bowl Half Marathon",
    routeId: "3270852741820273138",
  },
];

const { data: athletes } = await sb.from("athletes").select("id").limit(1);
if (!athletes?.length) {
  console.error("No athlete row.");
  process.exit(1);
}
const athleteId = athletes[0].id;

const { data: tok } = await sb
  .from("strava_tokens")
  .select("*")
  .eq("athlete_id", athleteId)
  .single();

let token = tok.access_token;
if (new Date(tok.expires_at).getTime() - 5 * 60 * 1000 < Date.now()) {
  console.log("Refreshing Strava token…");
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
  await sb
    .from("strava_tokens")
    .update({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: new Date(j.expires_at * 1000).toISOString(),
    })
    .eq("athlete_id", athleteId);
}

for (const c of COURSES) {
  const { data: race } = await sb
    .from("races")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("name", c.raceName)
    .maybeSingle();
  if (!race) {
    console.warn(`Skip ${c.raceName} — race row not found`);
    continue;
  }

  const r = await fetch(
    `https://www.strava.com/api/v3/routes/${c.routeId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) {
    console.error(`  ${c.raceName} → HTTP ${r.status}: ${await r.text()}`);
    continue;
  }
  const route = await r.json();
  // Prefer the detailed `polyline` (full route) over `summary_polyline`
  // (heavily downsampled — fine for thumbnails, jagged for a course map).
  const poly = route?.map?.polyline || route?.map?.summary_polyline || null;
  if (!poly) {
    console.warn(`  ${c.raceName} → no polyline on route`);
    continue;
  }
  const elev = route?.elevation_gain ?? null;
  await sb
    .from("races")
    .update({
      course_polyline: poly,
      course_elevation_gain_m: elev,
    })
    .eq("id", race.id);
  console.log(
    `  ✓ ${c.raceName} → ${poly.length} chars, elev ${elev ?? "?"} m`,
  );
}

console.log("Done.");
