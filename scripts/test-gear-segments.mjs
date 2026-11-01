// node --experimental-strip-types --test scripts/test-gear-segments.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gearShares,
  gearIdsFor,
  segmentMovingTimes,
} from "../lib/gear/segments.ts";

const MI = 1609.344;

test("single-shoe run credits the whole run to gear_id", () => {
  const shares = gearShares({ gear_id: "a", distance_m: 5000, moving_time_s: 1500 });
  assert.deepEqual(shares, [{ gear_id: "a", distance_m: 5000, moving_time_s: 1500 }]);
});

test("run with no shoe credits nothing", () => {
  assert.deepEqual(gearShares({ gear_id: null, distance_m: 5000, moving_time_s: 1500 }), []);
});

test("segments override gear_id and keep seq order", () => {
  const a = {
    gear_id: "strava-shoe",
    distance_m: 16.7 * MI,
    moving_time_s: 10000,
    gear_segments: [
      { activity_id: 1, seq: 1, gear_id: "triumph", distance_m: 4.2 * MI, moving_time_s: 2500 },
      { activity_id: 1, seq: 0, gear_id: "agravic", distance_m: 12.5 * MI, moving_time_s: 7500 },
    ],
  };
  assert.deepEqual(gearIdsFor(a), ["agravic", "triumph"]);
  const total = gearShares(a).reduce((s, x) => s + x.distance_m, 0);
  assert.ok(Math.abs(total - 16.7 * MI) < 1e-6);
});

test("missing segment time falls back to distance share of run time", () => {
  const shares = gearShares({
    gear_id: null,
    distance_m: 3000,
    moving_time_s: 900,
    gear_segments: [
      { activity_id: 1, seq: 0, gear_id: "a", distance_m: 2000, moving_time_s: null },
      { activity_id: 1, seq: 1, gear_id: "b", distance_m: 1000, moving_time_s: null },
    ],
  });
  assert.deepEqual(shares.map((s) => s.moving_time_s), [600, 300]);
});

test("stream times skip stopped samples and scale to run moving time", () => {
  // 0–1000 m in 300 s, a 600 s stop, then 1000–2000 m in 400 s.
  const streams = {
    distance_data: [0, 500, 1000, 1000, 1500, 2000],
    time_data: [0, 150, 300, 900, 1100, 1300],
    velocity_smooth_data: null,
  };
  assert.deepEqual(segmentMovingTimes([1000, 1000], streams, 700), [300, 400]);
});

test("no streams → split by distance", () => {
  assert.deepEqual(segmentMovingTimes([3000, 1000], null, 1600), [1200, 400]);
});
