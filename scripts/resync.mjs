#!/usr/bin/env node
// Re-sync recent activities + gear from Strava. Run after editing things in
// Strava (gear assignments, names, deletes). Safe to re-run.
//   node scripts/resync.mjs            -> last 30 days
//   node scripts/resync.mjs 2          -> last 2 years (full backfill)

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

// Load .env into process.env so the imported modules pick them up.
const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// We want to call backfillActivities() + syncGear() from lib/strava/sync.ts
// but those import @/lib/... using TS path aliases. Easier: re-implement
// inline using direct fetches.
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const yearsArg = Number(process.argv[2] ?? 0);
const days = yearsArg > 0 ? yearsArg * 365 : 30;

const { data: athletes } = await sb.from("athletes").select("id").limit(1);
const athleteId = athletes[0].id;
const { data: tok } = await sb.from("strava_tokens").select("*").eq("athlete_id", athleteId).single();

let token = tok.access_token;
if (new Date(tok.expires_at).getTime() - 5 * 60 * 1000 < Date.now()) {
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
  console.log("Refreshed token");
}

const ALLOWED = new Set(["Run", "TrailRun"]);
const after = Math.floor((Date.now() - days * 86400_000) / 1000);
let page = 1;
let synced = 0;
const gearIds = new Set();

for (;;) {
  const r = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) {
    console.error(`HTTP ${r.status}`);
    break;
  }
  const batch = await r.json();
  if (batch.length === 0) break;

  // For each run we need detail endpoint to get the polyline + accurate gear_id.
  for (const summary of batch) {
    if (!ALLOWED.has(summary.type)) continue;
    const dr = await fetch(`https://www.strava.com/api/v3/activities/${summary.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dr.ok) {
      console.error(`  ${summary.id}: HTTP ${dr.status}`);
      continue;
    }
    const a = await dr.json();
    if (a.gear_id) gearIds.add(a.gear_id);

    const row = {
      id: a.id,
      athlete_id: athleteId,
      type: a.type,
      sport_type: a.sport_type,
      name: a.name,
      start_date: a.start_date,
      start_date_local: a.start_date_local,
      timezone: a.timezone,
      distance_m: a.distance,
      moving_time_s: a.moving_time,
      elapsed_time_s: a.elapsed_time,
      total_elevation_gain_m: a.total_elevation_gain,
      average_speed_ms: a.average_speed,
      max_speed_ms: a.max_speed,
      average_heartrate: a.average_heartrate ?? null,
      max_heartrate: a.max_heartrate ?? null,
      has_heartrate: a.has_heartrate,
      average_cadence: a.average_cadence ?? null,
      calories: a.calories ?? null,
      suffer_score: a.suffer_score ?? null,
      gear_id: a.gear_id ?? null,
      map_id: a.map?.id ?? null,
      summary_polyline: a.map?.summary_polyline || a.map?.polyline || null,
      trainer: a.trainer,
      commute: a.commute,
      manual: a.manual,
      raw_jsonb: a,
      synced_at: new Date().toISOString(),
    };
    const { error } = await sb.from("activities").upsert(row, { onConflict: "id" });
    if (error) console.error(`  ${a.id}: ${error.message}`);
    else synced++;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (batch.length < 200) break;
  page++;
}

console.log(`Activities synced: ${synced}, unique gear ids: ${gearIds.size}`);

// Sync gear details
let gearOk = 0;
for (const id of gearIds) {
  const r = await fetch(`https://www.strava.com/api/v3/gear/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    console.error(`gear ${id}: HTTP ${r.status}`);
    continue;
  }
  const g = await r.json();
  const { error } = await sb.from("gear").upsert(
    {
      id: g.id,
      athlete_id: athleteId,
      name: g.name,
      brand_name: g.brand_name,
      model_name: g.model_name,
      description: g.description,
      distance_m: g.distance,
      retired: g.retired,
      primary_shoe: g.primary,
      nickname: g.nickname ?? null,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) console.error(`gear ${id}: ${error.message}`);
  else gearOk++;
  await new Promise((r) => setTimeout(r, 200));
}

console.log(`Gear synced: ${gearOk}/${gearIds.size}`);
