// Training-block CSV import. Pure — no DB or framework imports — so it can
// be unit-tested directly (scripts/test-plan-csv.mjs).
//
// Columns (header row optional, see public/plan-template.csv):
//   date (YYYY-MM-DD), workout_type, distance_mi, pace_per_mi (m:ss), description
// Blank lines and lines starting with # are ignored.

import type { WorkoutType } from "../types";

export const WORKOUT_TYPES: readonly WorkoutType[] = [
  "easy",
  "tempo",
  "interval",
  "long",
  "recovery",
  "rest",
  "race",
  "workout",
];

export const MAX_PLAN_ROWS = 500;

const M_PER_MILE = 1609.344;

export interface PlannedRunInput {
  scheduled_date: string;
  workout_type: WorkoutType;
  target_distance_m: number | null;
  target_pace_s_per_km: number | null;
  description: string | null;
}

export interface ParsedPlan {
  rows: PlannedRunInput[];
  errors: string[];
}

/** Split one CSV line, honoring "quoted, fields" and "" escapes. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** "9:30" → seconds per mile, or null if malformed. */
function parsePaceSecPerMile(pace: string): number | null {
  const m = pace.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

type RowResult = { row: PlannedRunInput } | { error: string };

function parseRow(cells: string[]): RowResult {
  const [date = "", type = "", distMi = "", pace = "", ...rest] = cells;
  const description = rest.join(",").trim();

  if (!isRealDate(date)) {
    return { error: `bad date "${date}" (use YYYY-MM-DD)` };
  }
  const workoutType = type.toLowerCase() as WorkoutType;
  if (!WORKOUT_TYPES.includes(workoutType)) {
    return {
      error: `unknown workout type "${type}" (use ${WORKOUT_TYPES.join(", ")})`,
    };
  }
  const miles = distMi === "" ? null : Number(distMi);
  if (miles !== null && (!Number.isFinite(miles) || miles < 0 || miles > 200)) {
    return { error: `bad distance "${distMi}" (miles, e.g. 6 or 6.5)` };
  }
  const paceSecPerMile = pace === "" ? null : parsePaceSecPerMile(pace);
  if (pace !== "" && paceSecPerMile === null) {
    return { error: `bad pace "${pace}" (per mile, e.g. 8:30)` };
  }

  return {
    row: {
      scheduled_date: date,
      workout_type: workoutType,
      target_distance_m: miles === null ? null : Math.round(miles * M_PER_MILE),
      target_pace_s_per_km:
        paceSecPerMile === null ? null : paceSecPerMile / (M_PER_MILE / 1000),
      description: description || null,
    },
  };
}

export function parsePlanCsv(text: string): ParsedPlan {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const rows: PlannedRunInput[] = [];
  const errors: string[] = [];

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const cells = splitCsvLine(line);
    // Header row: allowed before any data (comments may precede it).
    const seenData = rows.length + errors.length > 0;
    if (!seenData && cells[0]?.toLowerCase() === "date") return;
    const result = parseRow(cells);
    if ("row" in result) rows.push(result.row);
    else errors.push(`Line ${idx + 1}: ${result.error}`);
  });

  if (rows.length > MAX_PLAN_ROWS) {
    return {
      rows: [],
      errors: [
        `Too many rows (${rows.length}) — a block can have at most ${MAX_PLAN_ROWS}.`,
      ],
    };
  }
  return { rows, errors };
}

/**
 * "1:35:00" or "45:30" → seconds. Empty → null (no goal).
 * Malformed → undefined, so callers can tell "none" from "invalid".
 */
export function parseGoalTime(value: string): number | null | undefined {
  const v = value.trim();
  if (!v) return null;
  const parts = v.split(":");
  if (parts.length < 2 || parts.length > 3) return undefined;
  if (!parts.every((p) => /^\d+$/.test(p))) return undefined;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (s > 59 || (nums.length === 3 && m > 59)) return undefined;
  return h * 3600 + m * 60 + s;
}

/**
 * Replace mode keeps the past as recorded history: only rows dated today or
 * later replace the block's schedule; earlier rows are ignored.
 */
export function splitAtToday(
  rows: PlannedRunInput[],
  todayISO: string,
): { future: PlannedRunInput[]; ignoredPast: number } {
  const future = rows.filter((r) => r.scheduled_date >= todayISO);
  return { future, ignoredPast: rows.length - future.length };
}

/** A block ends on its last workout or its goal race, whichever is later. */
export function blockEndDate(dates: string[], raceDate?: string | null): string {
  const all = raceDate ? [...dates, raceDate] : dates;
  return all.reduce((max, d) => (d > max ? d : max));
}
