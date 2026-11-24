#!/usr/bin/env node
// Load a race course from a GPX file onto a race row (course_polyline +
// course_elevation_gain_m). For courses with no public Strava route.
// Run:  node scripts/import-race-course-gpx.mjs "<race name>" <file.gpx>

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { courseFromGpx } from "../lib/races/gpx.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const [raceName, gpxPath] = process.argv.slice(2);
if (!raceName || !gpxPath) {
  console.error('usage: import-race-course-gpx.mjs "<race name>" <file.gpx>');
  process.exit(1);
}

const course = courseFromGpx(readFileSync(gpxPath, "utf8"));
if (!course) {
  console.error(`No track points found in ${gpxPath}`);
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await sb
  .from("races")
  .update(course)
  .eq("name", raceName)
  .select("id");
if (error) throw error;
if (!data?.length) {
  console.error(`No race named "${raceName}"`);
  process.exit(1);
}
console.log(
  `  ✓ ${raceName} → ${course.course_polyline.length} chars, elev ${course.course_elevation_gain_m?.toFixed(1) ?? "?"} m`,
);
