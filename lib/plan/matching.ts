import { createServiceRoleSupabase } from "@/lib/supabase/server";
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
  distanceRatio: number;
}

/**
 * Score a potential match between an activity and a planned run.
 * Returns null if incompatible.
 */
export function scoreMatch(
  activity: Activity,
  planned: PlannedRun,
): MatchScore | null {
  const compat = COMPATIBLE[planned.workout_type];
  if (compat !== "any" && compat.length === 0) return null;

  // A run only ever counts for the day it happened. A ±1 day window let a
  // run satisfy tomorrow's still-open workout too (e.g. Sunday's 2 mi
  // showing as Monday's 4 mi easy).
  if (activity.start_date_local.slice(0, 10) !== planned.scheduled_date)
    return null;

  // Distance similarity: stricter for "long", looser for "easy"
  let distanceRatio = 1;
  if (planned.target_distance_m && planned.target_distance_m > 0) {
    const actMi = activity.distance_m / M_PER_MILE;
    const planMi = planned.target_distance_m / M_PER_MILE;
    distanceRatio = Math.min(actMi, planMi) / Math.max(actMi, planMi);

    // long runs require ±20%
    if (planned.workout_type === "long" && distanceRatio < 0.8) return null;
  }

  // Score: same day (0.5) + distance similarity (0.4) + type bonus (0.1).
  // Only matters for picking between multiple planned runs on one day.
  const typeBonus = 0.1; // placeholder — refine later when we classify activities
  const score = 0.5 + distanceRatio * 0.4 + typeBonus;

  return { planned, activity, score, distanceRatio };
}

/**
 * For a single activity, pick the best planned run to link it to.
 * Only candidates scheduled on the activity's local date can match.
 */
export function bestMatch(
  activity: Activity,
  candidates: PlannedRun[],
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
  today: string,
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

/**
 * Link recent activities to scheduled planned runs and flag stale ones as
 * missed. Mirrors `/api/cron/match-plan` but scoped to a single athlete so it
 * can run inside the user-triggered sync. Without this step, charts that
 * read `planned_runs.completed_activity_id` (Plan vs Actual mileage, Plan
 * Adherence) stay stale even after new activities are ingested.
 */
export async function matchPlannedRunsForAthlete(
  athleteId: string,
): Promise<{ linked: number; marked_missed: number }> {
  const admin = createServiceRoleSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const fourteenAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: plans } = await admin
    .from("training_plans")
    .select("id")
    .eq("athlete_id", athleteId);
  const planIds = (plans ?? []).map((p) => p.id as string);
  if (planIds.length === 0) return { linked: 0, marked_missed: 0 };

  const [
    { data: activities },
    { data: planned },
    { data: alreadyLinked, error: linkedErr },
  ] = await Promise.all([
    admin
      .from("activities")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("start_date_local", fourteenAgo),
    admin
      .from("planned_runs")
      .select("*")
      .in("plan_id", planIds)
      .gte("scheduled_date", fourteenAgo)
      .eq("completion_status", "scheduled"),
    // Activities already satisfying a planned run — never link one twice.
    admin
      .from("planned_runs")
      .select("completed_activity_id")
      .in("plan_id", planIds)
      .not("completed_activity_id", "is", null),
  ]);
  if (linkedErr) throw linkedErr;
  const usedActivityIds = new Set(
    (alreadyLinked ?? []).map((r) => Number(r.completed_activity_id)),
  );

  let linked = 0;
  if (activities && planned) {
    const claimed = new Set<string>();
    for (const a of activities as Activity[]) {
      if (usedActivityIds.has(Number(a.id))) continue;
      const actDate = a.start_date_local.slice(0, 10);
      const candidates = (planned as PlannedRun[]).filter(
        (p) => !claimed.has(p.id) && p.scheduled_date === actDate,
      );
      const m = bestMatch(a, candidates);
      if (!m) continue;
      claimed.add(m.planned.id);
      await admin
        .from("planned_runs")
        .update({
          completed_activity_id: a.id,
          completion_status: "completed",
        })
        .eq("id", m.planned.id);
      linked += 1;
    }
  }

  const missed = planned
    ? findMissedPlannedRuns(planned as PlannedRun[], today)
    : [];
  if (missed.length > 0) {
    await admin
      .from("planned_runs")
      .update({ completion_status: "missed" })
      .in(
        "id",
        missed.map((m) => m.id),
      );
  }

  return { linked, marked_missed: missed.length };
}
