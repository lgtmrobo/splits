// Physiological anchors the stress model scores against. Each one can be set
// by hand on the athlete row; otherwise it's estimated from data, and the
// page shows which source won so a bad estimate is obvious.
//
// No runtime imports — the node test runner loads these files directly.

export interface Thresholds {
  /** Speed sustainable for ~1 hour (m/s). Anchors pace-based TSS. */
  thresholdSpeedMs: number | null;
  /** Lactate-threshold heart rate. Anchors HR-based TSS. */
  lthr: number | null;
  restingHr: number | null;
  maxHr: number | null;
}

export type ThresholdSource = "set" | "estimated" | "default" | "missing";

export interface ThresholdOverrides {
  threshold_pace_s_per_km: number | null;
  lthr: number | null;
  resting_hr: number | null;
  max_hr: number | null;
}

export interface EffortSample {
  distance_m: number;
  elapsed_time_s: number;
  date: string; // YYYY-MM-DD
}

const DEFAULT_RESTING_HR = 55;
/** LTHR sits around 89% of max HR for trained runners (Friel). */
const LTHR_FRACTION_OF_MAX = 0.89;
const MAX_HR_LOOKBACK_DAYS = 365;
const EFFORT_LOOKBACK_DAYS = 180;
/** Shorter efforts overpredict 1-hour pace through Riegel. */
const MIN_EFFORT_M = 5000;
const MAX_EFFORT_M = 21200;
const PLAUSIBLE_MAX_HR = 220;
const RIEGEL_EXPONENT = 1.06;

function daysAgo(todayISO: string, dateISO: string): number {
  const t = Date.parse(todayISO.slice(0, 10) + "T00:00:00Z");
  const d = Date.parse(dateISO.slice(0, 10) + "T00:00:00Z");
  return Math.round((t - d) / 86400_000);
}

/** Riegel: speed you'd hold for `targetS` given `distance_m` in `time_s`. */
export function riegelSpeed(
  distance_m: number,
  time_s: number,
  targetS: number,
): number {
  // T2 = T1 · (D2/D1)^k  ⇒  D2 = D1 · (T2/T1)^(1/k)
  const d2 = distance_m * Math.pow(targetS / time_s, 1 / RIEGEL_EXPONENT);
  return d2 / targetS;
}

export function estimateThresholds(input: {
  activities: Array<{ start_date_local: string; max_heartrate: number | null }>;
  efforts: EffortSample[];
  restingHr: number | null;
  todayISO: string;
}): Thresholds {
  const { activities, efforts, restingHr, todayISO } = input;

  const recentMax = activities
    .filter((a) => daysAgo(todayISO, a.start_date_local) <= MAX_HR_LOOKBACK_DAYS)
    .map((a) => Number(a.max_heartrate ?? 0))
    .filter((hr) => hr > 0 && hr <= PLAUSIBLE_MAX_HR);
  const maxHr = recentMax.length ? Math.max(...recentMax) : null;

  const speeds = efforts
    .filter(
      (e) =>
        e.distance_m >= MIN_EFFORT_M &&
        e.distance_m <= MAX_EFFORT_M &&
        e.elapsed_time_s > 0 &&
        daysAgo(todayISO, e.date) <= EFFORT_LOOKBACK_DAYS,
    )
    .map((e) => riegelSpeed(e.distance_m, e.elapsed_time_s, 3600));

  return {
    thresholdSpeedMs: speeds.length ? Math.max(...speeds) : null,
    lthr: maxHr != null ? Math.round(maxHr * LTHR_FRACTION_OF_MAX) : null,
    restingHr: restingHr != null && restingHr > 0 ? Math.round(restingHr) : null,
    maxHr,
  };
}

export function resolveThresholds(
  overrides: ThresholdOverrides | null,
  estimates: Thresholds,
): { values: Thresholds; sources: Record<keyof Thresholds, ThresholdSource> } {
  const o = overrides ?? {
    threshold_pace_s_per_km: null,
    lthr: null,
    resting_hr: null,
    max_hr: null,
  };
  const pick = (
    set: number | null,
    est: number | null,
    fallback: number | null = null,
  ): [number | null, ThresholdSource] => {
    if (set != null) return [set, "set"];
    if (est != null) return [est, "estimated"];
    if (fallback != null) return [fallback, "default"];
    return [null, "missing"];
  };

  const [thresholdSpeedMs, sSpeed] = pick(
    o.threshold_pace_s_per_km ? 1000 / o.threshold_pace_s_per_km : null,
    estimates.thresholdSpeedMs,
  );
  const [lthr, sLthr] = pick(o.lthr, estimates.lthr);
  const [restingHr, sRest] = pick(o.resting_hr, estimates.restingHr, DEFAULT_RESTING_HR);
  const [maxHr, sMax] = pick(o.max_hr, estimates.maxHr);

  return {
    values: { thresholdSpeedMs, lthr, restingHr, maxHr },
    sources: {
      thresholdSpeedMs: sSpeed,
      lthr: sLthr,
      restingHr: sRest,
      maxHr: sMax,
    },
  };
}
