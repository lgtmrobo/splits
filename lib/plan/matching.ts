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
  dateDeltaDays: number;
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

  const actDate = activity.start_date_local.slice(0, 10);
  const planDate = planned.scheduled_date;
  const dateDeltaDays = Math.abs(
    Math.round(
      (new Date(actDate).getTime() - new Date(planDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
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

  const [{ data: activities }, { data: planned }] = await Promise.all([
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
  ]);

  let linked = 0;
  if (activities && planned) {
    const claimed = new Set<string>();
    for (const a of activities as Activity[]) {
      const candidates = (planned as PlannedRun[]).filter(
        (p) =>
          !claimed.has(p.id) &&
          Math.abs(
            new Date(p.scheduled_date).getTime() -
              new Date(a.start_date_local.slice(0, 10)).getTime(),
          ) <=
            1 * 24 * 3600 * 1000,
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
