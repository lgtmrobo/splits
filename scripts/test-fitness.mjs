// node --experimental-strip-types --test scripts/test-fitness.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateThresholds,
  resolveThresholds,
  riegelSpeed,
} from "../lib/fitness/thresholds.ts";
import { activityTss, plannedRunTss } from "../lib/fitness/tss.ts";
import { buildPmc, formZone, rampRate } from "../lib/fitness/pmc.ts";
import {
  extractEfforts,
  peakPerformances,
  vdot,
  bestVdot,
} from "../lib/fitness/best-efforts.ts";
import { gapFactor, gradeAdjustedSpeed } from "../lib/fitness/gap.ts";
import { weeklyTrailStats, longestTimeOnFeet } from "../lib/fitness/trail.ts";

const MI = 1609.344;
const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b}±${tol}, got ${a}`);

const THR = {
  thresholdSpeedMs: MI / 480, // 8:00/mi
  lthr: 165,
  restingHr: 50,
  maxHr: 185,
};

// ---------------------------------------------------------------- thresholds

test("riegel: same duration returns the same speed", () => {
  near(riegelSpeed(10000, 3600, 3600), 10000 / 3600, 1e-9);
});

test("riegel: a longer target duration is slower", () => {
  assert.ok(riegelSpeed(5000, 1200, 3600) < 5000 / 1200);
});

test("estimateThresholds uses recent max HR, ignoring spikes above 220", () => {
  const t = estimateThresholds({
    activities: [
      { start_date_local: "2026-10-01T08:00:00Z", max_heartrate: 181 },
      { start_date_local: "2026-10-02T08:00:00Z", max_heartrate: 240 },
      { start_date_local: "2024-01-01T08:00:00Z", max_heartrate: 199 }, // too old
    ],
    efforts: [],
    restingHr: 48,
    todayISO: "2026-11-05",
  });
  assert.equal(t.maxHr, 181);
  assert.equal(t.lthr, Math.round(181 * 0.89));
  assert.equal(t.restingHr, 48);
  assert.equal(t.thresholdSpeedMs, null);
});

test("estimateThresholds predicts 1-hour speed from the best 5K+ effort", () => {
  const t = estimateThresholds({
    activities: [],
    efforts: [
      { distance_m: 10000, elapsed_time_s: 2700, date: "2026-10-10" },
      { distance_m: 5000, elapsed_time_s: 1500, date: "2026-10-12" }, // slower equivalent
      { distance_m: 1609, elapsed_time_s: 300, date: "2026-10-12" }, // too short, ignored
      { distance_m: 10000, elapsed_time_s: 2000, date: "2025-01-01" }, // too old
    ],
    restingHr: null,
    todayISO: "2026-11-05",
  });
  near(t.thresholdSpeedMs, riegelSpeed(10000, 2700, 3600), 1e-9);
});

test("resolveThresholds prefers overrides, then estimates, then defaults", () => {
  const { values, sources } = resolveThresholds(
    { threshold_pace_s_per_km: 300, lthr: null, resting_hr: null, max_hr: 190 },
    { thresholdSpeedMs: 3, lthr: 160, restingHr: null, maxHr: 180 },
  );
  near(values.thresholdSpeedMs, 1000 / 300, 1e-9);
  assert.equal(sources.thresholdSpeedMs, "set");
  assert.equal(values.lthr, 160);
  assert.equal(sources.lthr, "estimated");
  assert.equal(values.restingHr, 55);
  assert.equal(sources.restingHr, "default");
  assert.equal(values.maxHr, 190);
});

// ---------------------------------------------------------------------- TSS

test("an hour at LTHR is 100 TSS", () => {
  const r = activityTss(
    { moving_time_s: 3600, distance_m: 12000, total_elevation_gain_m: 0, average_heartrate: 165 },
    THR,
  );
  assert.equal(r.method, "hr");
  near(r.tss, 100, 0.5);
});

test("an hour at threshold pace with no HR is 100 TSS", () => {
  const r = activityTss(
    { moving_time_s: 3600, distance_m: THR.thresholdSpeedMs * 3600, total_elevation_gain_m: 0, average_heartrate: null },
    THR,
  );
  assert.equal(r.method, "pace");
  near(r.tss, 100, 0.5);
});

test("climbing raises pace-based TSS", () => {
  const base = { moving_time_s: 3600, distance_m: 10000, average_heartrate: null };
  const flat = activityTss({ ...base, total_elevation_gain_m: 0 }, THR);
  const hilly = activityTss({ ...base, total_elevation_gain_m: 500 }, THR);
  assert.ok(hilly.tss > flat.tss);
});

test("no HR and no threshold pace falls back to duration", () => {
  const r = activityTss(
    { moving_time_s: 3600, distance_m: 10000, total_elevation_gain_m: 0, average_heartrate: null },
    { ...THR, thresholdSpeedMs: null },
  );
  assert.equal(r.method, "duration");
  near(r.tss, 49, 0.5); // IF 0.7
});

test("empty activity is 0 TSS", () => {
  const r = activityTss(
    { moving_time_s: 0, distance_m: 0, total_elevation_gain_m: 0, average_heartrate: null },
    THR,
  );
  assert.equal(r.tss, 0);
});

test("planned rest is 0 and tempo scores above easy for the same distance", () => {
  const p = (workout_type) => ({
    workout_type,
    target_distance_m: 10000,
    target_duration_s: null,
    target_pace_s_per_km: null,
  });
  assert.equal(plannedRunTss(p("rest"), THR), 0);
  const easy = plannedRunTss(p("easy"), THR);
  const tempo = plannedRunTss(p("tempo"), THR);
  assert.ok(easy > 0);
  assert.ok(tempo > easy);
});

test("planned run with no distance or duration is 0", () => {
  assert.equal(
    plannedRunTss({ workout_type: "easy", target_distance_m: null, target_duration_s: null, target_pace_s_per_km: null }, THR),
    0,
  );
});

test("an ultra race is capped at low intensity", () => {
  const ultra = plannedRunTss(
    { workout_type: "race", target_distance_m: 80000, target_duration_s: null, target_pace_s_per_km: null },
    THR,
  );
  // ~80 km at ≤0.7 of threshold speed → many hours but bounded intensity.
  const hours = 80000 / (THR.thresholdSpeedMs * 0.7) / 3600;
  assert.ok(ultra <= hours * 0.7 * 0.7 * 100 + 1);
});

// ---------------------------------------------------------------------- PMC

test("PMC: constant 100 TSS converges toward CTL 100 and TSB rises from negative", () => {
  const daily = {};
  for (let i = 0; i < 200; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86400_000).toISOString().slice(0, 10);
    daily[d] = 100;
  }
  const pts = buildPmc(daily, "2026-01-01", "2026-07-19", "2026-07-19");
  assert.equal(pts.length, 200);
  near(pts.at(-1).ctl, 100, 2);
  near(pts.at(-1).atl, 100, 0.1);
  assert.ok(pts[10].tsb < 0);
});

test("PMC: TSB is yesterday's CTL minus yesterday's ATL", () => {
  const pts = buildPmc({ "2026-01-01": 70 }, "2026-01-01", "2026-01-03", "2026-01-03");
  assert.equal(pts[0].tsb, 0);
  near(pts[1].tsb, pts[0].ctl - pts[0].atl, 1e-9);
});

test("PMC: days after today are flagged as projected", () => {
  const pts = buildPmc({}, "2026-01-01", "2026-01-05", "2026-01-03");
  assert.deepEqual(pts.map((p) => p.projected), [false, false, false, true, true]);
});

test("PMC: warmup days before start seed the model but are not returned", () => {
  const pts = buildPmc({ "2025-12-01": 500 }, "2026-01-01", "2026-01-02", "2026-01-02", "2025-12-01");
  assert.equal(pts.length, 2);
  assert.ok(pts[0].ctl > 0);
});

test("formZone matches TrainingPeaks bands", () => {
  assert.equal(formZone(30).key, "transition");
  assert.equal(formZone(10).key, "fresh");
  assert.equal(formZone(0).key, "neutral");
  assert.equal(formZone(-20).key, "optimal");
  assert.equal(formZone(-40).key, "risk");
});

test("rampRate is the CTL change over the past 7 days", () => {
  const pts = Array.from({ length: 10 }, (_, i) => ({ ctl: i * 2 }));
  assert.equal(rampRate(pts, 9), 14);
  assert.equal(rampRate(pts, 3), null);
});

// -------------------------------------------------------------- best efforts

const be = (name, distance, elapsed) => ({
  name,
  distance,
  elapsed_time: elapsed,
  moving_time: elapsed,
  pr_rank: null,
});

test("extractEfforts tolerates junk payloads", () => {
  assert.deepEqual(extractEfforts({ id: 1, start_date_local: "2026-01-01T00:00:00Z", best_efforts: null }), []);
  assert.deepEqual(extractEfforts({ id: 1, start_date_local: "2026-01-01T00:00:00Z", best_efforts: "nope" }), []);
  const out = extractEfforts({
    id: 7,
    start_date_local: "2026-03-04T07:00:00Z",
    best_efforts: [be("5K", 5000, 1400), { name: "bad" }, be("1 mile", 1609, -5)],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].activity_id, 7);
  assert.equal(out[0].date, "2026-03-04");
});

test("peakPerformances picks fastest all-time and recent per distance, in distance order", () => {
  const efforts = [
    ...extractEfforts({ id: 1, start_date_local: "2025-06-01T07:00:00Z", best_efforts: [be("5K", 5000, 1300), be("1 mile", 1609, 400)] }),
    ...extractEfforts({ id: 2, start_date_local: "2026-10-20T07:00:00Z", best_efforts: [be("5K", 5000, 1400), be("1 mile", 1609, 390)] }),
  ];
  const rows = peakPerformances(efforts, "2026-11-05", 84);
  assert.deepEqual(rows.map((r) => r.name), ["1 mile", "5K"]);
  const fiveK = rows.find((r) => r.name === "5K");
  assert.equal(fiveK.allTime.activity_id, 1);
  assert.equal(fiveK.recent.activity_id, 2);
  const mile = rows.find((r) => r.name === "1 mile");
  assert.equal(mile.allTime.activity_id, 2);
  assert.equal(mile.isRecentPr, true);
});

test("vdot matches Daniels' tables", () => {
  near(vdot(5000, 20 * 60), 49.8, 0.3); // 20:00 5K
  near(vdot(42195, 3 * 3600), 53.5, 0.6); // 3:00 marathon
});

test("bestVdot ignores short and stale efforts", () => {
  const efforts = [
    { name: "1 mile", distance_m: 1609, elapsed_time_s: 300, moving_time_s: 300, activity_id: 1, date: "2026-10-01", pr_rank: null },
    { name: "10K", distance_m: 10000, elapsed_time_s: 2700, moving_time_s: 2700, activity_id: 2, date: "2026-10-01", pr_rank: null },
    { name: "5K", distance_m: 5000, elapsed_time_s: 1000, moving_time_s: 1000, activity_id: 3, date: "2025-01-01", pr_rank: null },
  ];
  const r = bestVdot(efforts, "2026-11-05", 180);
  assert.equal(r.effort.activity_id, 2);
  near(r.vdot, vdot(10000, 2700), 1e-9);
  assert.equal(bestVdot([], "2026-11-05"), null);
});

// ----------------------------------------------------------------------- GAP

test("gapFactor: flat is 1, uphill costs more, gentle downhill less, steep downhill more again", () => {
  assert.equal(gapFactor(0), 1);
  assert.ok(gapFactor(10) > 1.3);
  assert.ok(gapFactor(-8) < 0.9);
  assert.ok(gapFactor(-25) > gapFactor(-8));
  assert.equal(gapFactor(60), gapFactor(30)); // clamped
});

test("gradeAdjustedSpeed equals actual speed on the flat and skips pauses", () => {
  // 80 s running at 3 m/s, a 370 s stop, then 10 more seconds.
  const time = [0, 10, 20, 30, 40, 50, 60, 70, 80, 450, 460];
  const distance = [0, 30, 60, 90, 120, 150, 180, 210, 240, 240, 270];
  const grade = time.map(() => 0);
  near(gradeAdjustedSpeed({ time, distance, grade }), 3, 1e-9);
});

test("gradeAdjustedSpeed is faster than actual uphill", () => {
  const time = Array.from({ length: 20 }, (_, i) => i * 10);
  const distance = time.map((t) => t * 2);
  const grade = time.map(() => 8);
  assert.ok(gradeAdjustedSpeed({ time, distance, grade }) > 2);
});

test("gradeAdjustedSpeed returns null without usable streams", () => {
  assert.equal(gradeAdjustedSpeed({ time: null, distance: [1], grade: [0] }), null);
  assert.equal(gradeAdjustedSpeed({ time: [0, 1], distance: [0, 1, 2], grade: [0, 0] }), null);
});

// --------------------------------------------------------------------- trail

test("weeklyTrailStats buckets by Monday week, oldest first, including empty weeks", () => {
  const acts = [
    { start_date_local: "2026-11-02T07:00:00Z", moving_time_s: 3600, distance_m: 10000, total_elevation_gain_m: 300, sport_type: "TrailRun" },
    { start_date_local: "2026-11-04T07:00:00Z", moving_time_s: 1800, distance_m: 5000, total_elevation_gain_m: 20, sport_type: "Run" },
    { start_date_local: "2026-10-20T07:00:00Z", moving_time_s: 600, distance_m: 2000, total_elevation_gain_m: null, sport_type: "Run" },
  ];
  const weeks = weeklyTrailStats(acts, "2026-11-05", 3);
  assert.deepEqual(weeks.map((w) => w.weekStart), ["2026-10-19", "2026-10-26", "2026-11-02"]);
  assert.equal(weeks[2].vertM, 320);
  assert.equal(weeks[2].timeS, 5400);
  assert.equal(weeks[2].trailRuns, 1);
  assert.equal(weeks[2].runs, 2);
  assert.equal(weeks[1].runs, 0);
  assert.equal(weeks[0].vertM, 0);
});

test("longestTimeOnFeet uses elapsed time", () => {
  const r = longestTimeOnFeet([
    { id: 1, moving_time_s: 5000, elapsed_time_s: 5200 },
    { id: 2, moving_time_s: 4800, elapsed_time_s: 9000 },
  ]);
  assert.equal(r.id, 2);
  assert.equal(longestTimeOnFeet([]), null);
});
