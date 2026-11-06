// Ultra/trail volume: vertical and time on feet per week. Miles undersell a
// slow, steep week; these are the numbers that matter for a 50K or a
// backyard ultra.
//
// No runtime imports — the node test runner loads these files directly.

export interface TrailInput {
  start_date_local: string;
  moving_time_s: number | null;
  distance_m: number | null;
  total_elevation_gain_m: number | null;
  sport_type: string | null;
}

export interface WeeklyTrail {
  weekStart: string; // Monday, YYYY-MM-DD
  vertM: number;
  timeS: number;
  distanceM: number;
  runs: number;
  trailRuns: number;
}

function addDays(iso: string, n: number): string {
  const t = Date.parse(iso.slice(0, 10) + "T00:00:00Z") + n * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const day = new Date(iso.slice(0, 10) + "T00:00:00Z").getUTCDay(); // 0 = Sun
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

/** The last `weeks` Monday-based weeks ending with the current one. */
export function weeklyTrailStats(
  activities: TrailInput[],
  todayISO: string,
  weeks = 16,
): WeeklyTrail[] {
  const thisMonday = mondayOf(todayISO);
  const buckets = new Map<string, WeeklyTrail>();
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(thisMonday, -7 * i);
    buckets.set(weekStart, { weekStart, vertM: 0, timeS: 0, distanceM: 0, runs: 0, trailRuns: 0 });
  }
  for (const a of activities) {
    const b = buckets.get(mondayOf(a.start_date_local));
    if (!b) continue;
    buckets.set(b.weekStart, {
      ...b,
      vertM: b.vertM + Number(a.total_elevation_gain_m ?? 0),
      timeS: b.timeS + Number(a.moving_time_s ?? 0),
      distanceM: b.distanceM + Number(a.distance_m ?? 0),
      runs: b.runs + 1,
      trailRuns: b.trailRuns + (a.sport_type === "TrailRun" ? 1 : 0),
    });
  }
  return [...buckets.values()];
}

/** Longest single outing by elapsed time — stops count on race day. */
export function longestTimeOnFeet<
  T extends { moving_time_s: number | null; elapsed_time_s: number | null },
>(activities: T[]): T | null {
  let best: T | null = null;
  let bestS = 0;
  for (const a of activities) {
    const s = Number(a.elapsed_time_s ?? a.moving_time_s ?? 0);
    if (s > bestS) {
      best = a;
      bestS = s;
    }
  }
  return best;
}
