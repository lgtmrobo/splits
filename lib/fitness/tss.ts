// Training Stress Score per run, TrainingPeaks-style: an hour at threshold
// = 100. TSS = hours · IF² · 100, where IF (intensity factor) is effort
// relative to threshold. IF comes from the best signal available:
//   1. heart rate   — HR reserve relative to LTHR (handles hills/heat/trails)
//   2. pace         — elevation-adjusted speed relative to threshold speed
//   3. duration     — assume a steady aerobic IF when we know nothing else
//
// No runtime imports — the node test runner loads these files directly.
import type { Thresholds } from "./thresholds";
import type { WorkoutType } from "@/lib/types";

export type TssMethod = "hr" | "pace" | "duration";

export interface TssInput {
  moving_time_s: number | null;
  distance_m: number | null;
  total_elevation_gain_m: number | null;
  average_heartrate: number | null;
}

export interface TssResult {
  tss: number;
  intensity: number;
  method: TssMethod;
}

/**
 * Flat metres one metre of climbing is worth. Calibrated so an out-and-back
 * (equal up and down) roughly matches the GAP curve in ./gap — descents give
 * some time back, so this is lower than the uphill-only "1 m ≈ 8 m" rule.
 */
export const CLIMB_EQUIVALENT_M = 4;
const FALLBACK_IF = 0.7;
const MAX_IF = 1.3;

function clampIf(v: number): number {
  return Math.min(Math.max(v, 0), MAX_IF);
}

function score(seconds: number, intensity: number): number {
  return Math.round((seconds / 3600) * intensity * intensity * 100);
}

export function activityTss(a: TssInput, t: Thresholds): TssResult {
  const seconds = Number(a.moving_time_s ?? 0);
  const distance = Number(a.distance_m ?? 0);
  if (seconds <= 0) return { tss: 0, intensity: 0, method: "duration" };

  const hr = Number(a.average_heartrate ?? 0);
  if (hr > 0 && t.lthr && t.restingHr && t.lthr > t.restingHr) {
    const intensity = clampIf((hr - t.restingHr) / (t.lthr - t.restingHr));
    return { tss: score(seconds, intensity), intensity, method: "hr" };
  }

  if (distance > 0 && t.thresholdSpeedMs) {
    const effortDistance =
      distance + CLIMB_EQUIVALENT_M * Number(a.total_elevation_gain_m ?? 0);
    const intensity = clampIf(effortDistance / seconds / t.thresholdSpeedMs);
    return { tss: score(seconds, intensity), intensity, method: "pace" };
  }

  return { tss: score(seconds, FALLBACK_IF), intensity: FALLBACK_IF, method: "duration" };
}

// ------------------------------------------------------------ planned runs

/** Whole-session IF by workout type (warmup/cooldown dilute the hard bits). */
const PLANNED_IF: Record<WorkoutType, number> = {
  rest: 0,
  recovery: 0.65,
  easy: 0.72,
  long: 0.75,
  tempo: 0.83,
  workout: 0.82,
  interval: 0.85,
  race: 0.9,
};
/** Past the marathon, race intensity collapses toward hiking/jogging. */
const ULTRA_THRESHOLD_M = 44000;
const ULTRA_IF = 0.65;
/** Used to turn distance into time when we have no threshold pace. */
const FALLBACK_THRESHOLD_SPEED_MS = 1609.344 / 450; // 7:30/mi

export interface PlannedInput {
  workout_type: WorkoutType;
  target_distance_m: number | null;
  target_duration_s: number | null;
}

/** Race IF falls with duration (Riegel): speed ∝ t^-0.06 relative to 1 h. */
function raceIntensity(distance: number, thrSpeed: number): number {
  if (distance > ULTRA_THRESHOLD_M) return ULTRA_IF;
  let intensity = PLANNED_IF.race;
  for (let i = 0; i < 4; i++) {
    const seconds = distance / (thrSpeed * intensity);
    intensity = clampIf(Math.pow(seconds / 3600, -0.06));
  }
  return intensity;
}

export function plannedRunTss(p: PlannedInput, t: Thresholds): number {
  if (p.workout_type === "rest") return 0;
  const distance = Number(p.target_distance_m ?? 0);
  const duration = Number(p.target_duration_s ?? 0);
  if (distance <= 0 && duration <= 0) return 0;

  const thrSpeed = t.thresholdSpeedMs ?? FALLBACK_THRESHOLD_SPEED_MS;
  const intensity =
    p.workout_type === "race" && distance > 0
      ? raceIntensity(distance, thrSpeed)
      : (PLANNED_IF[p.workout_type] ?? FALLBACK_IF);

  // Target pace is usually the hard-segment pace, not the session average,
  // so time comes from distance at the session-average intensity instead.
  const seconds = duration > 0 ? duration : distance / (thrSpeed * intensity);
  return score(seconds, intensity);
}
