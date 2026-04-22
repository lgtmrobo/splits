// Query layer. Server components call these functions; when Supabase is
// wired up, the bodies get replaced with real queries and no page code
// changes.
//
// Each function returns DB-shaped rows (see lib/types.ts) — zero UI
// formatting happens here.

import {
  ACTIVITIES,
  ATHLETE,
  COACH,
  CURRENT_WEEK_INDEX,
  DAILY_LOAD_28,
  GEAR,
  HR_CURVE,
  HR_ZONES,
  PACE_CURVE,
  PACE_TREND_12W,
  PLAN,
  PLANNED_RUNS,
  RACES,
  RESTING_HR_12W,
  ROUTE_POINTS,
  SPLITS,
  STATS_MONTHLY,
  TOTAL_MILES_PLANNED_M,
  TOTAL_WEEKS,
  WEEK_MILEAGE,
} from "@/lib/mock/data";
import type {
  Activity,
  Athlete,
  Gear,
  HRZone,
  PlannedRun,
  PlanWeekDay,
  Race,
  RunAnalysis,
  TrainingPlan,
  WeekMileage,
} from "@/lib/types";

// =========================================================================
// Athlete
// =========================================================================

export async function getCurrentAthlete(): Promise<Athlete> {
  return ATHLETE;
}

// =========================================================================
// Activities
// =========================================================================

export async function getRecentActivities(limit = 10): Promise<Activity[]> {
  return ACTIVITIES.slice(0, limit);
}

export async function getAllActivities(): Promise<Activity[]> {
  return ACTIVITIES;
}

export async function getActivityById(id: number | string): Promise<Activity | null> {
  const numId = typeof id === "string" ? Number(id) : id;
  return ACTIVITIES.find((a) => a.id === numId) ?? null;
}

// Mock activity summary totals — in real app these are SQL aggregates.
export async function getActivityTotals(): Promise<{
  count: number;
  distance_m: number;
  duration_s: number;
  distance_7d_m: number;
  distance_28d_m: number;
  distance_ytd_m: number;
  avg_pace_28d_ms: number;
  avg_hr_28d: number;
  elev_28d_m: number;
}> {
  const M = 1609.344;
  return {
    count: 187,
    distance_m: 1284 * M,
    duration_s: 174 * 3600 + 22 * 60,
    distance_7d_m: 42.3 * M,
    distance_28d_m: 148.2 * M,
    distance_ytd_m: 714 * M,
    avg_pace_28d_ms: M / (7 * 60 + 54), // 7:54 /mi
    avg_hr_28d: 148,
    elev_28d_m: 6240 * 0.3048,
  };
}

// =========================================================================
// Training plan
// =========================================================================

export async function getActivePlan(): Promise<TrainingPlan | null> {
  return PLAN;
}

export async function getPlanMeta(): Promise<{
  total_weeks: number;
  current_week_index: number;
  total_miles_planned_m: number;
  total_miles_actual_m: number;
  adherence_pct: number;
}> {
  const totalActual = WEEK_MILEAGE.reduce((acc, w) => acc + (w.actual_m ?? 0), 0);
  return {
    total_weeks: TOTAL_WEEKS,
    current_week_index: CURRENT_WEEK_INDEX,
    total_miles_planned_m: TOTAL_MILES_PLANNED_M,
    total_miles_actual_m: totalActual,
    adherence_pct: 96,
  };
}

export async function getWeekMileage(): Promise<WeekMileage[]> {
  return WEEK_MILEAGE;
}

export async function getPlannedRunsBetween(
  startISO: string,
  endISO: string
): Promise<PlannedRun[]> {
  return PLANNED_RUNS.filter((p) => p.scheduled_date >= startISO && p.scheduled_date <= endISO);
}

/** This week's planned runs + matched actuals, in a UI-friendly shape. */
export async function getWeekView(weekStartISO: string): Promise<PlanWeekDay[]> {
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const TODAY = "2026-04-18"; // pinned for demo; swap for new Date() when live

  const start = new Date(weekStartISO + "T00:00:00");
  const result: PlanWeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const planned = PLANNED_RUNS.find((p) => p.scheduled_date === iso) ?? null;
    const actual =
      planned?.completed_activity_id != null
        ? ACTIVITIES.find((a) => a.id === planned.completed_activity_id) ?? null
        : null;
    let status: PlanWeekDay["status"] = "upcoming";
    if (planned?.workout_type === "rest") status = "rest";
    else if (actual) status = "done";
    else if (iso === TODAY) status = "today";
    else if (iso < TODAY) status = "missed";

    result.push({
      day_short: DAYS_SHORT[d.getDay()],
      date_label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      date_iso: iso,
      planned,
      actual,
      status,
    });
  }
  return result;
}

// =========================================================================
// Gear
// =========================================================================

export async function getAllGear(): Promise<Gear[]> {
  return GEAR;
}

export async function getActiveGear(): Promise<Gear[]> {
  return GEAR.filter((g) => !g.retired);
}

export async function getGearById(id: string): Promise<Gear | null> {
  return GEAR.find((g) => g.id === id) ?? null;
}

// =========================================================================
// Races
// =========================================================================

export async function getAllRaces(): Promise<Race[]> {
  return RACES;
}

export async function getUpcomingRaces(): Promise<Race[]> {
  return RACES.filter((r) => r.status === "upcoming").sort(
    (a, b) => a.race_date.localeCompare(b.race_date)
  );
}

export async function getNextARace(): Promise<Race | null> {
  return (await getUpcomingRaces()).find((r) => r.priority === "A-race") ?? null;
}

// =========================================================================
// AI analyses
// =========================================================================

export async function getAnalysisForActivity(activityId: number): Promise<RunAnalysis | null> {
  if (activityId === COACH.activity_id) return COACH;
  return null;
}

// =========================================================================
// Streams + splits + route (for activity detail)
// =========================================================================

export async function getActivityDetail(activityId: number): Promise<{
  activity: Activity;
  hr_curve: number[];
  pace_curve: number[];
  splits: typeof SPLITS;
  route_points: [number, number][];
  zones: HRZone[];
} | null> {
  const activity = await getActivityById(activityId);
  if (!activity) return null;
  // For the mock, the threshold workout has real streams; everything else
  // shares the same demo data.
  return {
    activity,
    hr_curve: HR_CURVE,
    pace_curve: PACE_CURVE,
    splits: SPLITS,
    route_points: ROUTE_POINTS,
    zones: HR_ZONES,
  };
}

// =========================================================================
// HR zones + load
// =========================================================================

export async function getWeekHRZones(): Promise<HRZone[]> {
  return HR_ZONES;
}

export async function getDailyLoad28d(): Promise<number[]> {
  return DAILY_LOAD_28;
}

// =========================================================================
// Long-term stats
// =========================================================================

export async function getMonthlyStats() {
  return STATS_MONTHLY;
}

export async function getPaceTrend12w(): Promise<number[]> {
  return PACE_TREND_12W;
}

export async function getRestingHR12w(): Promise<number[]> {
  return RESTING_HR_12W;
}

// =========================================================================
// Mock-side stubs for queries added later (WHOOP / dashboard helpers)
// =========================================================================

export async function getPlannedRunByDate(dateISO: string) {
  return PLANNED_RUNS.find((p) => p.scheduled_date === dateISO) ?? null;
}

export async function getWeekStats(_weekStartISO: string) {
  const M = 1609.344;
  return {
    distance_m: 42.3 * M,
    duration_s: 5 * 3600 + 42 * 60,
    elev_m: 1842 * 0.3048,
    avg_hr: 148,
    runs: 5,
  };
}

export async function getStreakDays(): Promise<number> {
  return 14;
}

export async function getPlanAdherenceBreakdown() {
  const M = 1609.344;
  return {
    sessions: { done: 38, due: 40 },
    volume: { actual_m: 368 * M, planned_m: 382 * M },
    workouts: { done: 14, due: 14 },
  };
}

export async function getShellSummary() {
  return {
    activities: 187,
    gear: GEAR.length,
    races: RACES.filter((r) => r.status === "upcoming").length,
    plan: PLAN
      ? { name: PLAN.name, week: CURRENT_WEEK_INDEX + 1, totalWeeks: TOTAL_WEEKS, pct: 55 }
      : null,
    nextRace: RACES[0] ? { name: RACES[0].name, date: RACES[0].race_date, weeksOut: 9 } : null,
    lastSync: new Date(Date.now() - 4 * 60_000).toISOString(),
    lastSyncCount: 14,
  };
}

export async function getLatestRecovery() {
  return {
    date: "2026-04-18",
    resting_heart_rate: 49,
    hrv_rmssd_milli: 62,
    recovery_score: 78,
  };
}

export async function getWhoopWorkoutForActivity(_activityId: number) {
  return {
    strain: 14.2,
    zones_min: [4, 14, 12, 22, 6],
    total_min: 58,
    average_heart_rate: 164,
    max_heart_rate: 181,
  };
}
