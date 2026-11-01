// Shoe accounting for an activity. A run normally counts entirely toward its
// Strava gear_id, but a run done in two pairs (yards 1–3 in one shoe, yard 4
// in another) stores per-shoe segments in activity_gear_segments, and those
// win. Every place that credits miles/time/runs to a shoe goes through
// gearShares() so the two cases can't drift apart.
import type { Activity, ActivityGearSegment } from "@/lib/types";

export interface GearShare {
  gear_id: string;
  distance_m: number;
  moving_time_s: number;
}

type ShareSource = Pick<
  Activity,
  "gear_id" | "distance_m" | "moving_time_s" | "gear_segments"
>;

export function gearShares(a: ShareSource): GearShare[] {
  const segments = a.gear_segments ?? [];
  if (segments.length === 0) {
    if (!a.gear_id) return [];
    return [
      {
        gear_id: a.gear_id,
        distance_m: Number(a.distance_m ?? 0),
        moving_time_s: Number(a.moving_time_s ?? 0),
      },
    ];
  }
  const totalM = segments.reduce((sum, s) => sum + Number(s.distance_m), 0);
  const runMovingS = Number(a.moving_time_s ?? 0);
  return [...segments]
    .sort((x, y) => x.seq - y.seq)
    .map((s) => ({
      gear_id: s.gear_id,
      distance_m: Number(s.distance_m),
      // No stream-derived time stored → split the run's time by distance.
      moving_time_s:
        s.moving_time_s ??
        (totalM > 0 ? Math.round((runMovingS * Number(s.distance_m)) / totalM) : 0),
    }));
}

/** Distinct shoe ids an activity counts toward, in segment order. */
export function gearIdsFor(a: ShareSource): string[] {
  return [...new Set(gearShares(a).map((s) => s.gear_id))];
}

/** Group segment rows by activity id, each list in seq order. */
export function groupSegmentsByActivity(
  rows: ActivityGearSegment[],
): Map<number, ActivityGearSegment[]> {
  const byActivity = new Map<number, ActivityGearSegment[]>();
  for (const r of rows) {
    const id = Number(r.activity_id);
    byActivity.set(id, [...(byActivity.get(id) ?? []), r]);
  }
  for (const [id, list] of byActivity)
    byActivity.set(id, [...list].sort((x, y) => x.seq - y.seq));
  return byActivity;
}

// Below this speed a stream sample counts as stopped (aid-station breaks
// between yards), matching roughly how Strava derives moving time.
const MOVING_SPEED_MS = 0.5;

interface StreamSlice {
  distance_data: number[] | null;
  time_data: number[] | null;
  velocity_smooth_data: number[] | null;
}

/**
 * Moving seconds for consecutive segments of the given lengths, measured
 * from the run's distance/time streams and scaled so they add up to the
 * run's moving time. Without usable streams, splits by distance.
 */
export function segmentMovingTimes(
  segmentM: number[],
  streams: StreamSlice | null,
  runMovingS: number,
): number[] {
  const totalM = segmentM.reduce((a, b) => a + b, 0);
  const byDistance = () =>
    segmentM.map((m) => (totalM > 0 ? Math.round((runMovingS * m) / totalM) : 0));

  const dist = streams?.distance_data;
  const time = streams?.time_data;
  if (!dist || !time || dist.length < 2 || dist.length !== time.length)
    return byDistance();

  const ends = segmentM.reduce<number[]>(
    (acc, m) => [...acc, (acc[acc.length - 1] ?? 0) + m],
    [],
  );
  const moving = new Array(segmentM.length).fill(0);
  for (let i = 1; i < dist.length; i++) {
    const dt = time[i] - time[i - 1];
    if (dt <= 0) continue;
    const speed =
      streams?.velocity_smooth_data?.[i] ?? (dist[i] - dist[i - 1]) / dt;
    if (speed < MOVING_SPEED_MS) continue;
    const idx = ends.findIndex((end) => dist[i] <= end);
    moving[idx === -1 ? segmentM.length - 1 : idx] += dt;
  }
  const streamTotal = moving.reduce((a, b) => a + b, 0);
  if (streamTotal <= 0) return byDistance();
  const scale = runMovingS > 0 ? runMovingS / streamTotal : 1;
  return moving.map((s) => Math.round(s * scale));
}
