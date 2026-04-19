// Façade that swaps between real Supabase queries and the mock layer
// based on MOCK_DATA env var. Used by `npm run dev:mock` for screenshots
// and demos. Pages import from `@/lib/supabase/queries` regardless.

import * as real from "./queries.impl";
import * as mock from "@/lib/mock/queries";

const useMock = process.env.MOCK_DATA === "true";

// Cast mock to the real interface — they have the same function signatures
// (we maintain that invariant manually since TypeScript can't enforce
// equivalent shapes across two files automatically).
type Q = typeof real;
const Q: Q = useMock ? (mock as unknown as Q) : real;

export const getCurrentAthlete = Q.getCurrentAthlete;
export const getRecentActivities = Q.getRecentActivities;
export const getAllActivities = Q.getAllActivities;
export const getActivityById = Q.getActivityById;
export const getActivityTotals = Q.getActivityTotals;
export const getActivePlan = Q.getActivePlan;
export const getPlanMeta = Q.getPlanMeta;
export const getWeekMileage = Q.getWeekMileage;
export const getPlannedRunByDate = Q.getPlannedRunByDate;
export const getPlannedRunsBetween = Q.getPlannedRunsBetween;
export const getWeekView = Q.getWeekView;
export const getAllGear = Q.getAllGear;
export const getActiveGear = Q.getActiveGear;
export const getGearById = Q.getGearById;
export const getAllRaces = Q.getAllRaces;
export const getUpcomingRaces = Q.getUpcomingRaces;
export const getNextARace = Q.getNextARace;
export const getAnalysisForActivity = Q.getAnalysisForActivity;
export const getActivityDetail = Q.getActivityDetail;
export const getWeekHRZones = Q.getWeekHRZones;
export const getDailyLoad28d = Q.getDailyLoad28d;
export const getMonthlyStats = Q.getMonthlyStats;
export const getPaceTrend12w = Q.getPaceTrend12w;
export const getRestingHR12w = Q.getRestingHR12w;
export const getWeekStats = Q.getWeekStats;
export const getStreakDays = Q.getStreakDays;
export const getPlanAdherenceBreakdown = Q.getPlanAdherenceBreakdown;
export const getShellSummary = Q.getShellSummary;
export const getLatestRecovery = Q.getLatestRecovery;
export const getWhoopWorkoutForActivity = Q.getWhoopWorkoutForActivity;
