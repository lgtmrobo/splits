// Performance Management Chart (Banister impulse-response, TrainingPeaks
// constants): Fitness (CTL) is a 42-day exponentially weighted average of
// daily TSS, Fatigue (ATL) a 7-day one, and Form (TSB) is yesterday's
// fitness minus yesterday's fatigue — i.e. how fresh you are walking into
// today.
//
// No runtime imports — the node test runner loads these files directly.

export const CTL_DAYS = 42;
export const ATL_DAYS = 7;

export interface PmcPoint {
  date: string; // YYYY-MM-DD
  tss: number;
  ctl: number;
  atl: number;
  tsb: number;
  projected: boolean;
}

function addDays(iso: string, n: number): string {
  const t = Date.parse(iso.slice(0, 10) + "T00:00:00Z") + n * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * @param daily      TSS keyed by YYYY-MM-DD (actual for the past, planned
 *                   for the future — the caller decides which wins today)
 * @param warmupFrom optional earlier date to start the model from so CTL
 *                   isn't artificially zero at the left edge of the chart
 */
export function buildPmc(
  daily: Record<string, number>,
  startISO: string,
  endISO: string,
  todayISO: string,
  warmupFrom?: string,
): PmcPoint[] {
  const out: PmcPoint[] = [];
  let ctl = 0;
  let atl = 0;
  let day = warmupFrom && warmupFrom < startISO ? warmupFrom : startISO;
  // Hard stop guards against malformed inputs looping forever.
  for (let guard = 0; day <= endISO && guard < 20000; guard++) {
    const tss = daily[day] ?? 0;
    const tsb = ctl - atl;
    ctl += (tss - ctl) / CTL_DAYS;
    atl += (tss - atl) / ATL_DAYS;
    if (day >= startISO) {
      out.push({ date: day, tss, ctl, atl, tsb, projected: day > todayISO });
    }
    day = addDays(day, 1);
  }
  return out;
}

export type FormZoneKey = "transition" | "fresh" | "neutral" | "optimal" | "risk";

export interface FormZone {
  key: FormZoneKey;
  label: string;
  hint: string;
}

/** TrainingPeaks form bands. */
export function formZone(tsb: number): FormZone {
  if (tsb > 25)
    return { key: "transition", label: "Transition", hint: "Very fresh — fitness is decaying" };
  if (tsb > 5) return { key: "fresh", label: "Fresh", hint: "Race-ready" };
  if (tsb >= -10) return { key: "neutral", label: "Neutral", hint: "Maintaining" };
  if (tsb >= -30) return { key: "optimal", label: "Optimal", hint: "Productive training" };
  return { key: "risk", label: "High risk", hint: "Overreaching — back off" };
}

/** CTL gained over the 7 days ending at `index`. TP flags > ~8/week. */
export function rampRate(points: Array<{ ctl: number }>, index: number): number | null {
  if (index < 7 || index >= points.length) return null;
  return points[index].ctl - points[index - 7].ctl;
}
