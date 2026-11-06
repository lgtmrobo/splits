// Grade-adjusted pace: the flat-ground pace that would cost the same effort.
// The factor curve is a quadratic fit to Strava's HR-calibrated GAP model
// (2017): ~+44% at +10%, cheapest around −10% (~0.86), and steep descents
// getting harder again because you're braking.
//
// No runtime imports — the node test runner loads these files directly.

const MAX_GRADE_PCT = 30;
/** Gaps longer than this between samples are pauses, not running. */
const MAX_SAMPLE_GAP_S = 30;
/** Below walking-pace-ish speed we treat the sample as stopped. */
const MIN_MOVING_SPEED_MS = 0.5;
const MIN_MOVING_TIME_S = 60;

export function gapFactor(gradePct: number): number {
  const g = Math.min(Math.max(gradePct, -MAX_GRADE_PCT), MAX_GRADE_PCT);
  return 1 + 0.029 * g + 0.0015 * g * g;
}

/** Grade-adjusted speed in m/s from Strava streams, or null if unusable. */
export function gradeAdjustedSpeed(streams: {
  time: number[] | null;
  distance: number[] | null;
  grade: number[] | null;
}): number | null {
  const { time, distance, grade } = streams;
  if (!time || !distance || !grade) return null;
  if (time.length !== distance.length || time.length !== grade.length) return null;

  let adjusted = 0;
  let moving = 0;
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1];
    const dd = distance[i] - distance[i - 1];
    if (!(dt > 0) || dt > MAX_SAMPLE_GAP_S) continue;
    if (!(dd >= 0) || dd / dt < MIN_MOVING_SPEED_MS) continue;
    adjusted += dd * gapFactor(Number(grade[i]) || 0);
    moving += dt;
  }
  return moving >= MIN_MOVING_TIME_S ? adjusted / moving : null;
}
