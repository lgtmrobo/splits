// Triathlon training summary: hours by sport per week, recent volume and
// pace per discipline, longest session against the race's leg distances,
// and brick workouts. Pure (type-only imports) so scripts/test-tri.mjs can
// load it directly.

import type { Sport } from "@/lib/activities/sports";
import type { TriLegs } from "@/lib/races/types";

export interface TriActivity {
  sport: Sport;
  start_date_local: string; // athlete-local wall time, Strava-style "…Z"
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s: number | null;
}

export interface WeekHours {
  start: string; // Sunday, YYYY-MM-DD
  swim_s: number;
  bike_s: number;
  run_s: number;
}

export interface SportSummary {
  sessions: number;
  distance_m: number;
  time_s: number;
  /** Total distance / total moving time, m/s; null with no time logged. */
  speed_ms: number | null;
  /** Longest single session in the lookback, meters. */
  longest_m: number;
  /** longest_m as a share of the race leg (0–1+). */
  leg_pct: number;
}

export interface TriSummary {
  weeks: WeekHours[];
  /** Per sport over the last `recentWeeks` weeks (weekly averages derive from it). */
  recent: Record<Sport, SportSummary>;
  recentWeeks: number;
  bricks: { count: number; last: string | null };
}

const SPORTS: Sport[] = ["swim", "bike", "run"];
const DAY_MS = 86_400_000;
// A run starting within this long after a ride ends counts as a brick.
const BRICK_GAP_MS = 30 * 60_000;

function dayMs(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Sunday on or before the given YYYY-MM-DD. */
function sundayOf(iso: string): string {
  const ms = dayMs(iso);
  return isoOf(ms - new Date(ms).getUTCDay() * DAY_MS);
}

export function summarizeTri(
  activities: TriActivity[],
  legs: TriLegs,
  todayISO: string,
  { weeks = 12, recentWeeks = 4 } = {},
): TriSummary {
  const thisWeek = sundayOf(todayISO);
  const weekStarts = Array.from({ length: weeks }, (_, i) =>
    isoOf(dayMs(thisWeek) - (weeks - 1 - i) * 7 * DAY_MS),
  );
  const byWeek = new Map<string, WeekHours>(
    weekStarts.map((start) => [start, { start, swim_s: 0, bike_s: 0, run_s: 0 }]),
  );
  const recentFrom = isoOf(dayMs(thisWeek) - (recentWeeks - 1) * 7 * DAY_MS);
  const legM: Record<Sport, number> = { swim: legs.swim_m, bike: legs.bike_m, run: legs.run_m };
  const recent = Object.fromEntries(
    SPORTS.map((s) => [
      s,
      { sessions: 0, distance_m: 0, time_s: 0, speed_ms: null, longest_m: 0, leg_pct: 0 },
    ]),
  ) as Record<Sport, SportSummary>;

  for (const a of activities) {
    const day = a.start_date_local.slice(0, 10);
    const week = byWeek.get(sundayOf(day));
    if (week) week[`${a.sport}_s`] += a.moving_time_s;
    if (day >= recentFrom && day <= todayISO) {
      const r = recent[a.sport];
      r.sessions += 1;
      r.distance_m += a.distance_m;
      r.time_s += a.moving_time_s;
      r.longest_m = Math.max(r.longest_m, a.distance_m);
    }
  }
  for (const s of SPORTS) {
    const r = recent[s];
    r.speed_ms = r.time_s > 0 ? r.distance_m / r.time_s : null;
    r.leg_pct = legM[s] > 0 ? r.longest_m / legM[s] : 0;
  }

  return {
    weeks: weekStarts.map((w) => byWeek.get(w)!),
    recent,
    recentWeeks,
    bricks: findBricks(activities, recentFrom, todayISO),
  };
}

/** Ride → run back to back (run starts ≤30 min after the ride ends). */
function findBricks(
  activities: TriActivity[],
  fromISO: string,
  toISO: string,
): { count: number; last: string | null } {
  const sorted = activities
    .filter((a) => a.sport !== "swim")
    .map((a) => ({ ...a, startMs: Date.parse(a.start_date_local) }))
    .sort((x, y) => x.startMs - y.startMs);
  let count = 0;
  let last: string | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const ride = sorted[i];
    if (ride.sport !== "bike") continue;
    const day = ride.start_date_local.slice(0, 10);
    if (day < fromISO || day > toISO) continue;
    const rideEnd = ride.startMs + (ride.elapsed_time_s ?? ride.moving_time_s) * 1000;
    const next = sorted[i + 1];
    if (next.sport === "run" && next.startMs - rideEnd <= BRICK_GAP_MS && next.startMs >= rideEnd - 60_000) {
      count += 1;
      last = day;
    }
  }
  return { count, last };
}
