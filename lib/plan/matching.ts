import type { Activity, PlannedRun, WorkoutType } from "@/lib/types";

const M_PER_MILE = 1609.344;

// Types we allow to satisfy each planned workout. "any" means any run type.
const COMPATIBLE: Record<WorkoutType, "any" | string[]> = {
  easy: "any",
  recovery: "any",
  tempo: "any",
  interval: "any",
  long: "any",
  workout: "any",
  rest: [], // rest is never "satisfied" by a run
  race: "any",
};

export interface MatchScore {
  planned: PlannedRun;
  activity: Activity;
  score: number; // 0..1
  dateDeltaDays: number;
  distanceRatio: number;
}

/**
 * Score a potential match between an activity and a planned run.
 * Returns null if incompatible.
 */
export function scoreMatch(
  activity: Activity,
  planned: PlannedRun
): MatchScore | null {
  const compat = COMPATIBLE[planned.workout_type];
  if (compat !== "any" && compat.length === 0) return null;

  const actDate = activity.start_date_local.slice(0, 10);
  const planDate = planned.scheduled_date;
  const dateDeltaDays = Math.abs(
    Math.round(
      (new Date(actDate).getTime() - new Date(planDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  if (dateDeltaDays > 1) return null;

  // Distance similarity: stricter for "long", looser for "easy"
  let distanceRatio = 1;
  if (planned.target_distance_m && planned.target_distance_m > 0) {
    const actMi = activity.distance_m / M_PER_MILE;
    const planMi = planned.target_distance_m / M_PER_MILE;
    distanceRatio = Math.min(actMi, planMi) / Math.max(actMi, planMi);

    // long runs require ±20%
    if (planned.workout_type === "long" && distanceRatio < 0.8) return null;
  }

  // Score: weight date proximity (0.5) + distance similarity (0.4) + type bonus (0.1)
  const dateScore = dateDeltaDays === 0 ? 1 : 0.5;
  const distScore = distanceRatio;
  const typeBonus = 0.1; // placeholder — refine later when we classify activities
  const score = dateScore * 0.5 + distScore * 0.4 + typeBonus;

  return { planned, activity, score, dateDeltaDays, distanceRatio };
}

/**
 * For a single activity, pick the best planned run to link it to.
 * `candidates` should be all planned runs for the same plan within ±1 day.
 */
export function bestMatch(
  activity: Activity,
  candidates: PlannedRun[]
): MatchScore | null {
  let best: MatchScore | null = null;
  for (const p of candidates) {
    if (p.completion_status !== "scheduled") continue;
    const s = scoreMatch(activity, p);
    if (s && (!best || s.score > best.score)) best = s;
  }
  // Require a minimum confidence — dodges weak matches that'd surprise the user.
  if (!best || best.score < 0.55) return null;
  return best;
}

/**
 * Decide which planned runs should be flagged "missed" — scheduled, in the
 * past (> 2 days ago), with no completed_activity_id.
 */
export function findMissedPlannedRuns(
  planned: PlannedRun[],
  today: string
): PlannedRun[] {
  const todayTime = new Date(today).getTime();
  return planned.filter((p) => {
    if (p.completion_status !== "scheduled") return false;
    if (p.completed_activity_id != null) return false;
    if (p.workout_type === "rest") return false;
    const planTime = new Date(p.scheduled_date).getTime();
    const daysPast = (todayTime - planTime) / (1000 * 60 * 60 * 24);
    return daysPast > 2;
  });
}
