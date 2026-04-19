#!/usr/bin/env node
// Manual WHOOP backfill — useful when the on-connect fire-and-forget
// fails silently. Run:  node scripts/whoop-backfill.mjs [days]

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const days = Number(process.argv[2] ?? 30);
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const OAUTH = "https://api.prod.whoop.com/oauth/oauth2/token";
const API = "https://api.prod.whoop.com/developer";

const { data: athletes } = await sb.from("athletes").select("id").limit(1);
const athleteId = athletes[0].id;
const { data: tok } = await sb.from("whoop_tokens").select("*").eq("athlete_id", athleteId).single();

let token = tok.access_token;
if (new Date(tok.expires_at).getTime() - 5 * 60 * 1000 < Date.now()) {
  console.log("Refreshing token…");
  const body = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: tok.refresh_token,
    scope: "offline",
  });
  const r = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!r.ok) {
    console.error("Refresh failed:", j);
    process.exit(1);
  }
  token = j.access_token;
  await sb.from("whoop_tokens").update({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
    scope: j.scope,
    updated_at: new Date().toISOString(),
  }).eq("athlete_id", athleteId);
}

async function paginate(path) {
  const out = [];
  let next = null;
  do {
    const params = new URLSearchParams({
      start: new Date(Date.now() - days * 86400_000).toISOString(),
      limit: "25",
    });
    if (next) params.set("nextToken", next);
    const url = `${API}${path}?${params.toString()}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      console.error(`${path}: HTTP ${r.status}`, await r.text());
      return out;
    }
    const j = await r.json();
    out.push(...(j.records ?? []));
    next = j.next_token;
  } while (next);
  return out;
}

const recovery = await paginate("/v2/recovery");
console.log(`Recovery: ${recovery.length} records`);
const recRows = recovery.filter((r) => r.score_state === "SCORED" && r.score).map((r) => ({
  athlete_id: athleteId,
  date: new Date(r.created_at).toISOString().slice(0, 10),
  cycle_id: r.cycle_id,
  sleep_id: r.sleep_id,
  recovery_score: r.score?.recovery_score ?? null,
  resting_heart_rate: r.score?.resting_heart_rate ?? null,
  hrv_rmssd_milli: r.score?.hrv_rmssd_milli ?? null,
  spo2_percentage: r.score?.spo2_percentage ?? null,
  skin_temp_celsius: r.score?.skin_temp_celsius ?? null,
  user_calibrating: r.score?.user_calibrating ?? false,
  raw_jsonb: r,
  synced_at: new Date().toISOString(),
}));
if (recRows.length) {
  const { error } = await sb.from("whoop_recovery").upsert(recRows, { onConflict: "athlete_id,date" });
  if (error) console.error("recovery upsert:", error);
  else console.log(`  inserted ${recRows.length}`);
}

const cycles = await paginate("/v1/cycle");
console.log(`Cycles: ${cycles.length} records`);
const cycRows = cycles.map((c) => ({
  id: c.id,
  athlete_id: athleteId,
  start_at: c.start,
  end_at: c.end,
  strain: c.score?.strain ?? null,
  kilojoule: c.score?.kilojoule ?? null,
  average_heart_rate: c.score?.average_heart_rate ?? null,
  max_heart_rate: c.score?.max_heart_rate ?? null,
  raw_jsonb: c,
  synced_at: new Date().toISOString(),
}));
if (cycRows.length) {
  const { error } = await sb.from("whoop_cycles").upsert(cycRows, { onConflict: "id" });
  if (error) console.error("cycles upsert:", error);
  else console.log(`  inserted ${cycRows.length}`);
}

const workouts = await paginate("/v2/activity/workout");
console.log(`Workouts: ${workouts.length} records`);

// Match to activities
const { data: acts } = await sb
  .from("activities")
  .select("id, start_date")
  .eq("athlete_id", athleteId)
  .gte("start_date", new Date(Date.now() - (days + 1) * 86400_000).toISOString());
console.log(`  candidate activities: ${acts?.length ?? 0}`);

function findMatch(whoopStart) {
  const t = new Date(whoopStart).getTime();
  let best = null;
  for (const a of acts ?? []) {
    const diff = Math.abs(new Date(a.start_date).getTime() - t);
    if (diff <= 10 * 60 * 1000 && (!best || diff < best.diff)) {
      best = { id: Number(a.id), diff };
    }
  }
  return best;
}

const woRows = workouts.map((w) => {
  const m = findMatch(w.start);
  return {
    id: w.id,
    athlete_id: athleteId,
    start_at: w.start,
    end_at: w.end,
    sport_name: w.sport_name ?? null,
    strain: w.score?.strain ?? null,
    average_heart_rate: w.score?.average_heart_rate ?? null,
    max_heart_rate: w.score?.max_heart_rate ?? null,
    zone_zero_ms: w.score?.zone_durations?.zone_zero_milli ?? null,
    zone_one_ms: w.score?.zone_durations?.zone_one_milli ?? null,
    zone_two_ms: w.score?.zone_durations?.zone_two_milli ?? null,
    zone_three_ms: w.score?.zone_durations?.zone_three_milli ?? null,
    zone_four_ms: w.score?.zone_durations?.zone_four_milli ?? null,
    zone_five_ms: w.score?.zone_durations?.zone_five_milli ?? null,
    matched_activity_id: m?.id ?? null,
    raw_jsonb: w,
    synced_at: new Date().toISOString(),
  };
});

if (woRows.length) {
  const { error } = await sb.from("whoop_workouts").upsert(woRows, { onConflict: "id" });
  if (error) console.error("workouts upsert:", error);
  else {
    const matched = woRows.filter((w) => w.matched_activity_id != null).length;
    console.log(`  inserted ${woRows.length}, matched to activities: ${matched}`);
  }
}

console.log("\nDone.");
