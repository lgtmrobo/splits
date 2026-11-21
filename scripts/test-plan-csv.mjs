// node --experimental-strip-types --test scripts/test-plan-csv.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  blockEndDate,
  parseGoalTime,
  parsePlanCsv,
  splitAtToday,
  splitCsvLine,
} from "../lib/plan/csv.ts";

const MI = 1609.344;
const HEADER = "date,workout_type,distance_mi,pace_per_mi,description";

test("splitCsvLine handles quotes, escaped quotes and commas", () => {
  assert.deepEqual(splitCsvLine('a,"b, c","say ""hi""",'), ["a", "b, c", 'say "hi"', ""]);
});

test("parses rows with a header, converting miles and pace", () => {
  const { rows, errors } = parsePlanCsv(
    `${HEADER}\n2027-01-04,easy,5,9:30,Easy 5\n2027-01-06,workout,8,7:05,"4x1mi @ threshold, 2:00 jog"`,
  );
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].scheduled_date, "2027-01-04");
  assert.equal(rows[0].workout_type, "easy");
  assert.equal(rows[0].target_distance_m, Math.round(5 * MI));
  assert.ok(Math.abs(rows[0].target_pace_s_per_km - 570 / (MI / 1000)) < 0.01);
  assert.equal(rows[1].description, "4x1mi @ threshold, 2:00 jog");
});

test("works without a header, with CRLF, BOM, blank and comment lines", () => {
  const { rows, errors } = parsePlanCsv(
    "﻿# my block\r\n2027-01-04,Long,14,,\r\n\r\n2027-01-05,rest,,,\r\n",
  );
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].workout_type, "long");
  assert.equal(rows[0].target_pace_s_per_km, null);
  assert.equal(rows[1].target_distance_m, null);
  assert.equal(rows[1].description, null);
});

test("reports bad rows by line number and keeps the good ones", () => {
  const { rows, errors } = parsePlanCsv(
    `${HEADER}\n2027-02-30,easy,5,,\n2027-01-04,jog,5,,\n2027-01-05,easy,-3,,\n2027-01-06,easy,5,fast,\n2027-01-07,easy,5,,ok`,
  );
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 4);
  assert.match(errors[0], /^Line 2: .*date/);
  assert.match(errors[1], /^Line 3: .*workout type/);
  assert.match(errors[2], /^Line 4: .*distance/);
  assert.match(errors[3], /^Line 5: .*pace/);
});

test("rejects files over the row limit", () => {
  const lines = Array.from({ length: 501 }, () => "2027-01-04,easy,5,,");
  const { rows, errors } = parsePlanCsv(lines.join("\n"));
  assert.equal(rows.length, 0);
  assert.match(errors[0], /500/);
});

test("the shipped template parses cleanly", () => {
  const csv = readFileSync(new URL("../public/plan-template.csv", import.meta.url), "utf8");
  const { rows, errors } = parsePlanCsv(csv);
  assert.deepEqual(errors, []);
  assert.ok(rows.length >= 7);
});

test("parseGoalTime accepts h:mm:ss and mm:ss", () => {
  assert.equal(parseGoalTime("1:35:00"), 5700);
  assert.equal(parseGoalTime("45:30"), 2730);
  assert.equal(parseGoalTime(""), null);
  assert.equal(parseGoalTime("1:75:00"), undefined);
  assert.equal(parseGoalTime("abc"), undefined);
});

// ------------------------------------------------------------ replace mode
test("splitAtToday keeps today and later, counts ignored past rows", () => {
  const { rows } = parsePlanCsv(
    "2027-01-04,easy,5,,\n2027-01-05,rest,,,\n2027-01-06,long,10,,\n2027-01-07,easy,4,,",
  );
  const { future, ignoredPast } = splitAtToday(rows, "2027-01-06");
  assert.deepEqual(future.map((r) => r.scheduled_date), ["2027-01-06", "2027-01-07"]);
  assert.equal(ignoredPast, 2);
});

test("blockEndDate is the latest of all dates and the race date", () => {
  assert.equal(blockEndDate(["2027-01-04", "2027-02-01", "2027-01-10"]), "2027-02-01");
  assert.equal(blockEndDate(["2027-01-04"], "2027-03-01"), "2027-03-01");
  assert.equal(blockEndDate(["2027-01-04"], null), "2027-01-04");
});
