#!/usr/bin/env node
// One-time backfill: Strava's list endpoint returns empty `summary_polyline`,
// so we hit the detail endpoint per activity to grab the full `polyline`.
// Run:  node scripts/backfill-polylines.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: athletes } = await sb.from("athletes").select("id").limit(1);
if (!athletes?.length) {
  console.error("No athlete row.");
  process.exit(1);
}
const athleteId = athletes[0].id;
const { data: tok } = await sb.from("strava_tokens").select("*").eq("athlete_id", athleteId).single();

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

const { data: needs } = await sb
  .from("activities")
  .select("id")
  .eq("athlete_id", athleteId)
  .or("summary_polyline.is.null,summary_polyline.eq.")
  .eq("trainer", false)
  .eq("manual", false);

console.log(`${needs?.length ?? 0} activities need polyline backfill`);
let ok = 0;
let skipped = 0;
let failed = 0;

for (const a of needs ?? []) {
  const r = await fetch(`https://www.strava.com/api/v3/activities/${a.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 429) {
    console.error("Rate limited — stop and wait 15 min");
    break;
  }
  if (!r.ok) {
    failed++;
    console.error(`  ${a.id} → HTTP ${r.status}`);
    continue;
  }
  const detail = await r.json();
  const poly = detail?.map?.polyline || detail?.map?.summary_polyline || null;
  if (!poly) {
    skipped++;
    continue;
  }
  await sb
    .from("activities")
    .update({ summary_polyline: poly, map_id: detail.map?.id ?? null })
    .eq("id", a.id);
  ok++;
  // Be polite: ~1 request / 200ms = 300/min, well under 100/15min limit
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`Done — updated ${ok}, no polyline ${skipped}, failed ${failed}`);
