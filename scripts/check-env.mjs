#!/usr/bin/env node
// Setup doctor: checks .env.local for missing values and verifies that
// Supabase is reachable and the migrations have been applied.
// Run:  pnpm check-env

import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ENV_FILE = new URL("../.env.local", import.meta.url);

const REQUIRED = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase → Project Settings → API"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase → Project Settings → API"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase → Project Settings → API"],
  ["STRAVA_CLIENT_ID", "strava.com/settings/api"],
  ["STRAVA_CLIENT_SECRET", "strava.com/settings/api"],
  ["STRAVA_WEBHOOK_VERIFY_TOKEN", "any random string: openssl rand -hex 16"],
  ["NEXT_PUBLIC_APP_URL", "http://localhost:3000 locally, your domain in prod"],
  ["CRON_SECRET", "any random string: openssl rand -hex 32"],
];

const OPTIONAL = [
  ["NEXT_PUBLIC_MAPBOX_TOKEN", "route maps + heatmap"],
  ["WHOOP_CLIENT_ID", "WHOOP recovery / HRV"],
  ["WHOOP_CLIENT_SECRET", "WHOOP recovery / HRV"],
  ["ANTHROPIC_API_KEY", "AI run analysis"],
  ["APP_TIMEZONE", "defaults to America/Los_Angeles"],
];

const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => console.log(`  ✗ ${msg}`);
const warn = (msg) => console.log(`  · ${msg}`);

if (!existsSync(ENV_FILE)) {
  console.log("✗ No .env.local found. Run:  cp .env.example .env.local");
  process.exit(1);
}
process.loadEnvFile(ENV_FILE);

console.log("\nRequired");
const missing = REQUIRED.filter(([key]) => !process.env[key]);
for (const [key, hint] of REQUIRED) {
  process.env[key] ? ok(key) : bad(`${key} — ${hint}`);
}
const allowlist = process.env.ALLOWED_EMAILS ?? process.env.ALLOWED_EMAIL;
if (allowlist) {
  const n = allowlist.split(",").filter((e) => e.trim()).length;
  ok(`ALLOWED_EMAILS (${n} ${n === 1 ? "person" : "people"}; first is the owner)`);
} else {
  missing.push(["ALLOWED_EMAILS"]);
  bad("ALLOWED_EMAILS — comma-separated Google emails allowed to sign in, owner first");
}

console.log("\nOptional");
for (const [key, purpose] of OPTIONAL) {
  process.env[key] ? ok(key) : warn(`${key} not set — ${purpose}`);
}

if (process.env.DEV_AUTH_BYPASS === "true") {
  console.log("\n  ! DEV_AUTH_BYPASS=true — fine locally, never set it in production.");
}

console.log("\nDatabase");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
let dbOk = false;
if (!url || !key) {
  bad("skipped — Supabase URL / service role key missing");
} else {
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    // races.race_type is the newest migration's column — a cheap "fully migrated" check.
    const { error } = await sb.from("races").select("id, race_type").limit(1);
    if (!error) {
      ok("connected, schema up to date");
      dbOk = true;
    } else if (error.code === "42703") {
      bad("connected, but a newer migration is missing — apply supabase/migrations (see README)");
    } else if (error.code === "42P01" || error.code === "PGRST205") {
      bad("connected, but tables are missing — apply supabase/migrations (see README)");
    } else {
      bad(`query failed: ${error.message}`);
    }
  } catch (e) {
    bad(`could not reach Supabase: ${e.message}`);
  }
}

const ready = missing.length === 0 && dbOk;
console.log(ready ? "\nAll set — run `pnpm dev`.\n" : "\nFix the ✗ items above, then re-run `pnpm check-env`.\n");
process.exit(ready ? 0 : 1);
