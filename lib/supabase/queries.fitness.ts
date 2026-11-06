import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getLatestRecovery, getUpcomingRaces } from "@/lib/supabase/queries.impl";
import { addDaysISO, todayLocalISO } from "@/lib/utils/dates";
import { gradeAdjustedSpeed } from "@/lib/fitness/gap";
import type { FitnessActivity, FitnessInputs } from "@/lib/fitness/types";
import type { ThresholdOverrides } from "@/lib/fitness/thresholds";
import type { PlannedRun } from "@/lib/types";

/** How far ahead the form projection reads the plan. */
const PROJECTION_DAYS = 120;

const ACTIVITY_COLUMNS =
  "id, name, start_date_local, sport_type, distance_m, moving_time_s, elapsed_time_s, total_elevation_gain_m, average_heartrate, max_heartrate, best_efforts";

/**
 * All inputs for the fitness model. Wrapped in React `cache` so the fitness
 * page and activity detail page can both call it within one render without
 * refetching.
 */
export const getFitnessInputs = cache(async (): Promise<FitnessInputs> => {
  const sb = await createServerSupabase();
  const today = todayLocalISO();

  const [acts, planned, upcomingRaces, athlete, recovery] = await Promise.all([
    sb.from("activities").select(ACTIVITY_COLUMNS).order("start_date", { ascending: true }),
    sb
      .from("planned_runs")
      .select("*")
      .gte("scheduled_date", today)
      .lte("scheduled_date", addDaysISO(today, PROJECTION_DAYS))
      .order("scheduled_date", { ascending: true }),
    getUpcomingRaces(),
    sb
      .from("athletes")
      .select("threshold_pace_s_per_km, lthr, resting_hr, max_hr")
      .maybeSingle(),
    getLatestRecovery(),
  ]);
  if (acts.error) throw new Error(`fitness: activities query failed: ${acts.error.message}`);
  if (planned.error) throw new Error(`fitness: planned_runs query failed: ${planned.error.message}`);
  if (athlete.error) throw new Error(`fitness: athlete thresholds query failed: ${athlete.error.message}`);

  const a = athlete.data;
  const overrides: ThresholdOverrides | null = a
    ? {
        threshold_pace_s_per_km: a.threshold_pace_s_per_km != null ? Number(a.threshold_pace_s_per_km) : null,
        lthr: a.lthr ?? null,
        resting_hr: a.resting_hr ?? null,
        max_hr: a.max_hr ?? null,
      }
    : null;

  return {
    todayISO: today,
    activities: (acts.data ?? []).map((r) => ({
      ...r,
      distance_m: r.distance_m != null ? Number(r.distance_m) : null,
      total_elevation_gain_m: r.total_elevation_gain_m != null ? Number(r.total_elevation_gain_m) : null,
      average_heartrate: r.average_heartrate != null ? Number(r.average_heartrate) : null,
      max_heartrate: r.max_heartrate != null ? Number(r.max_heartrate) : null,
    })) as FitnessActivity[],
    planned: (planned.data ?? []) as PlannedRun[],
    upcomingRaces,
    overrides,
    restingHr:
      recovery?.resting_heart_rate != null ? Number(recovery.resting_heart_rate) : null,
  };
});

/** Grade-adjusted speed (m/s) from cached streams; null if not fetched yet. */
export async function getGradeAdjustedSpeed(activityId: number): Promise<number | null> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("activity_streams")
    .select("time_data, distance_data, grade_smooth_data")
    .eq("activity_id", activityId)
    .maybeSingle();
  if (error) {
    console.error(`[getGradeAdjustedSpeed] activity ${activityId}:`, error.message);
    return null;
  }
  if (!data) return null;
  return gradeAdjustedSpeed({
    time: data.time_data as number[] | null,
    distance: data.distance_data as number[] | null,
    grade: data.grade_smooth_data as number[] | null,
  });
}
