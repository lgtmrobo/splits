#!/usr/bin/env node
// Load a race course from a GPX file onto a race row (course_polyline +
// course_elevation_gain_m). For courses with no public Strava route.
// Run:  node scripts/import-race-course-gpx.mjs "<race name>" <file.gpx>

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// Ignore elevation wiggles smaller than this so GPS noise doesn't inflate gain.
const GAIN_HYSTERESIS_M = 2;

function parseGpx(xml) {
  const pts = [];
  const re = /<trkpt\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"[^>]*>(?:\s*<ele>([-\d.]+)<\/ele>)?/g;
  for (const m of xml.matchAll(re)) {
    pts.push({ lat: Number(m[1]), lng: Number(m[2]), ele: m[3] != null ? Number(m[3]) : null });
  }
  return pts;
}

// Google encoded polyline, precision 5 — same format Strava uses, so it
// decodes through lib/strava/polyline.ts.
function encodePolyline(points) {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  const encodeValue = (v) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const { lat, lng } of points) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    out += encodeValue(la - prevLat) + encodeValue(ln - prevLng);
    prevLat = la;
    prevLng = ln;
  }
  return out;
}

function elevationGain(points) {
  const eles = points.map((p) => p.ele).filter((e) => e != null);
  if (eles.length === 0) return null;
  let gain = 0;
  let ref = eles[0];
  for (const e of eles) {
    if (e - ref >= GAIN_HYSTERESIS_M) {
      gain += e - ref;
      ref = e;
    } else if (ref - e >= GAIN_HYSTERESIS_M) {
      ref = e;
    }
  }
  return gain;
}

const points = parseGpx(readFileSync(gpxPath, "utf8"));
if (points.length < 2) {
  console.error(`No track points found in ${gpxPath}`);
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const polyline = encodePolyline(points);
const gain = elevationGain(points);
const { data, error } = await sb
  .from("races")
  .update({ course_polyline: polyline, course_elevation_gain_m: gain })
  .eq("name", raceName)
  .select("id");
if (error) throw error;
if (!data?.length) {
  console.error(`No race named "${raceName}"`);
  process.exit(1);
}
console.log(
  `  ✓ ${raceName} → ${points.length} pts, ${polyline.length} chars, elev ${gain?.toFixed(1) ?? "?"} m`,
);
