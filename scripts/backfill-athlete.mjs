#!/usr/bin/env node
// Import an athlete's full Strava history. Invited athletes start with
// history_from = connect time (only new runs sync); this clears it so the
// webhook, cron and manual sync all treat them like the owner from now on.
//
//   node scripts/backfill-athlete.mjs <email> [years=20] [details=100]
//
// Runs the app's own sync code (lib/strava/sync.ts). Summaries are one
// Strava call per 200 runs; detail fetches (polylines, best efforts) cost
// one call each, so only `details` of them run now — the daily cron and
// manual syncs fill in the rest 50 at a time.

import { register } from "node:module";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);

for (const file of [".env.local", ".env"]) {
  let raw;
  try {
    raw = readFileSync(new URL(file, root), "utf8");
  } catch {
    continue;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  break;
}

// Resolve the app's "@/…" path alias (and extensionless next/* subpaths) so
// the TypeScript sync modules load under plain Node with type stripping.
register(
  "data:text/javascript," +
    encodeURIComponent(`
      const root = ${JSON.stringify(root.href)};
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith("@/")) {
          return next(new URL(specifier.slice(2) + ".ts", root).href, context);
        }
        if (specifier === "next/headers") return next("next/headers.js", context);
        return next(specifier, context);
      }
    `),
);

const [email, yearsArg = "20", detailsArg = "100"] = process.argv.slice(2);
if (!email) {
  console.error("usage: backfill-athlete.mjs <email> [years=20] [details=100]");
  process.exit(1);
}

const { createServiceRoleSupabase } = await import("../lib/supabase/server.ts");
const { backfillActivities, backfillDetails, syncGear } = await import(
  "../lib/strava/sync.ts"
);
const { matchPlannedRunsForAthlete } = await import("../lib/plan/matching.ts");

const sb = createServiceRoleSupabase();
const { data: athlete, error } = await sb
  .from("athletes")
  .select("id, first_name, history_from")
  .eq("email", email)
  .maybeSingle();
if (error) throw error;
if (!athlete) {
  console.error(`No athlete with email ${email}`);
  process.exit(1);
}

if (athlete.history_from) {
  const { error: updErr } = await sb
    .from("athletes")
    .update({ history_from: null })
    .eq("id", athlete.id);
  if (updErr) throw updErr;
  console.log(`  ✓ ${athlete.first_name}: cleared history cutoff (${athlete.history_from})`);
}

const { inserted } = await backfillActivities(athlete.id, Number(yearsArg));
console.log(`  ✓ ${inserted} runs from the last ${yearsArg} years`);

await syncGear(athlete.id);
console.log("  ✓ gear synced");

const details = await backfillDetails(athlete.id, Number(detailsArg));
console.log(
  `  ✓ details: ${details.updated} filled; older runs fill in on later syncs` +
    (details.rateLimited ? " (stopped at Strava's rate limit)" : ""),
);

const matched = await matchPlannedRunsForAthlete(athlete.id);
console.log(`  ✓ plan matching: ${matched.linked} linked`);
