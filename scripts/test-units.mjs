// node --experimental-strip-types --test scripts/test-units.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatPace,
  paceFromTime,
  secPerKmToPacePerMile,
  speedToPacePerMile,
} from "../lib/utils/units.ts";

const MI = 1609.344;

test("pace a hair under a whole minute rounds up to :00, not :60", () => {
  assert.equal(formatPace(539.998), "9:00");
  assert.equal(formatPace(599.6), "10:00");
});

test("ordinary paces", () => {
  assert.equal(formatPace(494), "8:14");
  assert.equal(formatPace(420.4), "7:00");
});

test("goal time over a half marathon", () => {
  // 1:57:59 over 13.1 mi is 8:59.998/mi — shown as 9:00.
  assert.equal(paceFromTime(21097.5, 7079), "9:00");
  assert.equal(paceFromTime(21097.5, 7080), "9:00");
});

test("speed and s/km inputs go through the same rounding", () => {
  assert.equal(speedToPacePerMile(MI / 539.998), "9:00");
  assert.equal(secPerKmToPacePerMile(539.998 / (MI / 1000)), "9:00");
});

test("no pace for zero or missing input", () => {
  assert.equal(speedToPacePerMile(0), "—");
  assert.equal(speedToPacePerMile(null), "—");
  assert.equal(formatPace(Infinity), "—");
});
