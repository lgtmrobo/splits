#!/usr/bin/env node
/**
 * Register the Strava webhook subscription.
 * Run ONCE after your app is deployed to a public URL.
 *
 *   node scripts/register-strava-webhook.mjs
 *
 * Reads from .env.local:
 *   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
 *   STRAVA_WEBHOOK_VERIFY_TOKEN, NEXT_PUBLIC_APP_URL
 *
 * Strava allows only ONE subscription per app. If you already have one,
 * this script will print the existing subscription. Use --delete to
 * tear it down first.
 */
import { readFileSync } from "node:fs";
import { argv } from "node:process";

function loadEnv() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // ignore — env may already be set
  }
}
loadEnv();

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN, NEXT_PUBLIC_APP_URL } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_WEBHOOK_VERIFY_TOKEN || !NEXT_PUBLIC_APP_URL) {
  console.error("Missing required env vars. Check .env.local.");
  process.exit(1);
}

const API = "https://www.strava.com/api/v3/push_subscriptions";
const callback_url = `${NEXT_PUBLIC_APP_URL}/api/strava/webhook`;

async function listSubs() {
  const url = new URL(API);
  url.searchParams.set("client_id", STRAVA_CLIENT_ID);
  url.searchParams.set("client_secret", STRAVA_CLIENT_SECRET);
  const r = await fetch(url);
  return r.json();
}

async function createSub() {
  const body = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    callback_url,
    verify_token: STRAVA_WEBHOOK_VERIFY_TOKEN,
  });
  const r = await fetch(API, { method: "POST", body });
  return r.json();
}

async function deleteSub(id) {
  const body = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
  });
  const r = await fetch(`${API}/${id}`, { method: "DELETE", body });
  return r.status === 204 ? { ok: true } : r.json();
}

const cmd = argv[2];
const existing = await listSubs();

if (cmd === "--delete") {
  if (Array.isArray(existing) && existing.length > 0) {
    for (const sub of existing) {
      console.log(`Deleting subscription #${sub.id}...`);
      console.log(await deleteSub(sub.id));
    }
  } else {
    console.log("No subscriptions to delete.");
  }
  process.exit(0);
}

if (Array.isArray(existing) && existing.length > 0) {
  console.log("Subscription already exists:");
  console.log(existing);
  console.log(`\nCallback: ${existing[0].callback_url}`);
  console.log(`To replace: re-run with --delete then again to create.`);
  process.exit(0);
}

console.log(`Creating subscription → ${callback_url}`);
const created = await createSub();
console.log(created);
if (!created.id) {
  console.error(
    "\n⚠️  Subscription creation failed. Common causes:\n" +
      "  1. callback_url must be publicly reachable (won't work on localhost without a tunnel)\n" +
      "  2. The webhook GET handler must echo hub.challenge correctly\n" +
      "  3. STRAVA_WEBHOOK_VERIFY_TOKEN must match on both sides"
  );
  process.exit(1);
}
