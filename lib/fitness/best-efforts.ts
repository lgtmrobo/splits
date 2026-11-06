// Peak performances from Strava's per-activity `best_efforts` (the fastest
// 400m / mile / 5K / … segment inside each run, computed by Strava from the
// GPS stream). Only the detail endpoint returns them, so they're stored in
// their own column and backfilled — see backfillDetails in lib/strava/sync.
//
// No runtime imports — the node test runner loads these files directly.

export interface BestEffort {
  name: string;
  distance_m: number;
  elapsed_time_s: number;
  moving_time_s: number;
  activity_id: number;
  date: string; // YYYY-MM-DD (local)
  pr_rank: number | null;
}

export interface PeakRow {
  name: string;
  distance_m: number;
  allTime: BestEffort;
  recent: BestEffort | null;
  /** The all-time best was set inside the recent window. */
  isRecentPr: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function positive(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse Strava's payload defensively — it's external data. */
export function extractEfforts(activity: {
  id: number;
  start_date_local: string;
  best_efforts: unknown;
}): BestEffort[] {
  if (!Array.isArray(activity.best_efforts)) return [];
  const date = activity.start_date_local.slice(0, 10);
  const out: BestEffort[] = [];
  for (const raw of activity.best_efforts) {
    if (!isRecord(raw) || typeof raw.name !== "string") continue;
    const distance = positive(raw.distance);
    const elapsed = positive(raw.elapsed_time);
    if (distance == null || elapsed == null) continue;
    out.push({
      name: raw.name,
      distance_m: distance,
      elapsed_time_s: elapsed,
      moving_time_s: positive(raw.moving_time) ?? elapsed,
      activity_id: activity.id,
      date,
      pr_rank: positive(raw.pr_rank),
    });
  }
  return out;
}

function daysAgo(todayISO: string, dateISO: string): number {
  return Math.round(
    (Date.parse(todayISO + "T00:00:00Z") - Date.parse(dateISO + "T00:00:00Z")) /
      86400_000,
  );
}

function faster(a: BestEffort | null, b: BestEffort): BestEffort {
  return !a || b.elapsed_time_s < a.elapsed_time_s ? b : a;
}

export function peakPerformances(
  efforts: BestEffort[],
  todayISO: string,
  recentDays = 84,
): PeakRow[] {
  const byName = new Map<string, { all: BestEffort | null; recent: BestEffort | null }>();
  for (const e of efforts) {
    const cur = byName.get(e.name) ?? { all: null, recent: null };
    const isRecent = daysAgo(todayISO, e.date) <= recentDays;
    byName.set(e.name, {
      all: faster(cur.all, e),
      recent: isRecent ? faster(cur.recent, e) : cur.recent,
    });
  }
  return [...byName.entries()]
    .filter((entry): entry is [string, { all: BestEffort; recent: BestEffort | null }] =>
      entry[1].all !== null,
    )
    .map(([name, { all, recent }]) => ({
      name,
      distance_m: all.distance_m,
      allTime: all,
      recent,
      isRecentPr: daysAgo(todayISO, all.date) <= recentDays,
    }))
    .sort((a, b) => a.distance_m - b.distance_m);
}

/** Jack Daniels' VDOT from a single performance. */
export function vdot(distance_m: number, time_s: number): number {
  const t = time_s / 60;
  const v = distance_m / t; // m/min
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const pct =
    0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / pct;
}

/** VDOT needs a real race-length effort — mile repeats overstate it. */
const VDOT_MIN_DISTANCE_M = 5000;

export function bestVdot(
  efforts: BestEffort[],
  todayISO: string,
  days = 180,
): { vdot: number; effort: BestEffort } | null {
  let best: { vdot: number; effort: BestEffort } | null = null;
  for (const e of efforts) {
    if (e.distance_m < VDOT_MIN_DISTANCE_M) continue;
    if (daysAgo(todayISO, e.date) > days) continue;
    const v = vdot(e.distance_m, e.elapsed_time_s);
    if (!best || v > best.vdot) best = { vdot: v, effort: e };
  }
  return best;
}
