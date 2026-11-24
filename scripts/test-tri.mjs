// node --experimental-strip-types --test scripts/test-tri.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeTri } from "../lib/tri/summary.ts";

const MI = 1609.344;
const LEGS = { swim_m: 1.2 * MI, bike_m: 56 * MI, run_m: 21097.5 };
const act = (sport, start, distance_m, moving_time_s, elapsed_time_s = moving_time_s) => ({
  sport,
  start_date_local: start,
  distance_m,
  moving_time_s,
  elapsed_time_s,
});

// Today is Wednesday 2026-11-25; its week starts Sunday 2026-11-22.
const TODAY = "2026-11-25";

test("weeks are Sunday-start and end with the current week", () => {
  const s = summarizeTri([], LEGS, TODAY);
  assert.equal(s.weeks.length, 12);
  assert.equal(s.weeks.at(-1).start, "2026-11-22");
  assert.equal(s.weeks[0].start, "2026-09-06");
});

test("hours land in the right week and sport", () => {
  const s = summarizeTri(
    [
      act("swim", "2026-11-22T07:00:00Z", 2000, 2400),
      act("bike", "2026-11-21T07:00:00Z", 40000, 4800), // Saturday: previous week
      act("run", "2026-11-24T07:00:00Z", 8000, 2700),
    ],
    LEGS,
    TODAY,
  );
  const [prev, cur] = s.weeks.slice(-2);
  assert.deepEqual(cur, { start: "2026-11-22", swim_s: 2400, bike_s: 0, run_s: 2700 });
  assert.equal(prev.bike_s, 4800);
});

test("recent window: totals, speed, longest vs leg", () => {
  const s = summarizeTri(
    [
      act("bike", "2026-11-01T07:00:00Z", 28 * MI, 5400), // first day of the 4-week window
      act("bike", "2026-11-15T07:00:00Z", 42 * MI, 8400),
      act("bike", "2026-10-31T07:00:00Z", 60 * MI, 12000), // just outside
    ],
    LEGS,
    TODAY,
  );
  const b = s.recent.bike;
  assert.equal(b.sessions, 2);
  assert.equal(b.longest_m, 42 * MI);
  assert.ok(Math.abs(b.leg_pct - 0.75) < 1e-9);
  assert.equal(b.speed_ms, (70 * MI) / 13800);
  assert.equal(s.recent.swim.speed_ms, null);
});

test("a run right after a ride is a brick; a later run isn't", () => {
  const s = summarizeTri(
    [
      act("bike", "2026-11-14T07:00:00Z", 50000, 7000, 7200), // ends 09:00
      act("run", "2026-11-14T09:10:00Z", 5000, 1500),
      act("bike", "2026-11-21T07:00:00Z", 50000, 7000, 7200),
      act("run", "2026-11-21T12:00:00Z", 5000, 1500),
    ],
    LEGS,
    TODAY,
  );
  assert.deepEqual(s.bricks, { count: 1, last: "2026-11-14" });
});
