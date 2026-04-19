// Mock data — shaped to match the DB schema exactly. When Supabase is
// wired up, swap these queries in lib/mock/queries.ts for real ones and
// nothing downstream changes.

import type {
  Activity,
  Athlete,
  Gear,
  HRZone,
  PlannedRun,
  Race,
  RunAnalysis,
  TrainingPlan,
  WeekMileage,
} from "@/lib/types";

const ATHLETE_ID = "00000000-0000-0000-0000-000000000001";
const PLAN_ID = "11111111-1111-1111-1111-111111111111";
const RACE_A = "22222222-2222-2222-2222-222222222221";
const RACE_B = "22222222-2222-2222-2222-222222222222";
const RACE_C = "22222222-2222-2222-2222-222222222223";
const RACE_D = "22222222-2222-2222-2222-222222222224";
const RACE_E = "22222222-2222-2222-2222-222222222225";

const M_PER_MILE = 1609.344;
const M_PER_FT = 0.3048;

// Helpers for terse mock writing — NOT used at runtime for real activities.
const mi = (x: number) => Math.round(x * M_PER_MILE);
const ft = (x: number) => Math.round(x * M_PER_FT * 10) / 10;

// pace "M:SS" /mi → m/s average_speed
const paceToMs = (pace: string): number => {
  const [m, s] = pace.split(":").map(Number);
  const secPerMile = m * 60 + (s || 0);
  return M_PER_MILE / secPerMile;
};

// ============================================================
// ATHLETE
// ============================================================

export const ATHLETE: Athlete = {
  id: ATHLETE_ID,
  supabase_user_id: null,
  strava_athlete_id: 12345678,
  email: "you@example.com",
  first_name: "Lucas",
  last_name: null,
  profile_image_url: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2026-04-18T14:00:00Z",
};

// ============================================================
// ACTIVITIES — recent, most-recent first
// ============================================================

export const ACTIVITIES: Activity[] = [
  {
    id: 10_000_000_012,
    athlete_id: ATHLETE_ID,
    type: "Run",
    sport_type: "Run",
    name: "Morning Shakeout",
    start_date: "2026-04-17T13:42:00Z",
    start_date_local: "2026-04-17T06:42:00-07:00",
    timezone: "America/Los_Angeles",
    distance_m: mi(5.2),
    moving_time_s: 2568,
    elapsed_time_s: 2580,
    total_elevation_gain_m: ft(128),
    average_speed_ms: paceToMs("8:14"),
    max_speed_ms: paceToMs("7:10"),
    average_heartrate: 142,
    max_heartrate: 158,
    has_heartrate: true,
    average_cadence: 178,
    calories: 512,
    suffer_score: 22,
    gear_id: "g_endorphin_speed_4",
    map_id: "m12",
    summary_polyline: null,
    trainer: false,
    commute: false,
    manual: false,
    synced_at: "2026-04-17T15:00:00Z",
    created_at: "2026-04-17T15:00:00Z",
  },
  {
    id: 10_000_000_011,
    athlete_id: ATHLETE_ID,
    type: "Run",
    sport_type: "Run",
    name: "Threshold 4×1mi",
    start_date: "2026-04-16T12:58:00Z",
    start_date_local: "2026-04-16T05:58:00-07:00",
    timezone: "America/Los_Angeles",
    distance_m: mi(8.3),
    moving_time_s: 3498,
    elapsed_time_s: 3512,
    total_elevation_gain_m: ft(202),
    average_speed_ms: paceToMs("7:02"),
    max_speed_ms: paceToMs("6:48"),
    average_heartrate: 164,
    max_heartrate: 181,
    has_heartrate: true,
    average_cadence: 184,
    calories: 864,
    suffer_score: 142,
    gear_id: "g_endorphin_pro_4",
    map_id: "m11",
    summary_polyline: null,
    trainer: false,
    commute: false,
    manual: false,
    synced_at: "2026-04-16T14:00:00Z",
    created_at: "2026-04-16T14:00:00Z",
  },
  {
    id: 10_000_000_010,
    athlete_id: ATHLETE_ID,
    type: "Run",
    sport_type: "Run",
    name: "Recovery Jog",
    start_date: "2026-04-14T13:15:00Z",
    start_date_local: "2026-04-14T06:15:00-07:00",
    timezone: "America/Los_Angeles",
    distance_m: mi(3.8),
    moving_time_s: 2052,
    elapsed_time_s: 2080,
    total_elevation_gain_m: ft(62),
    average_speed_ms: paceToMs("9:00"),
    max_speed_ms: paceToMs("8:10"),
    average_heartrate: 128,
    max_heartrate: 141,
    has_heartrate: true,
    average_cadence: 170,
    calories: 402,
    suffer_score: 12,
    gear_id: "g_endorphin_speed_4",
    map_id: "m10",
    summary_polyline: null,
    trainer: false,
    commute: false,
    manual: false,
    synced_at: "2026-04-14T15:00:00Z",
    created_at: "2026-04-14T15:00:00Z",
  },
  {
    id: 10_000_000_009,
    athlete_id: ATHLETE_ID,
    type: "Run",
    sport_type: "Run",
    name: "Long Run — Riverside",
    start_date: "2026-04-13T13:30:00Z",
    start_date_local: "2026-04-13T06:30:00-07:00",
    timezone: "America/Los_Angeles",
    distance_m: mi(14.1),
    moving_time_s: 6900,
    elapsed_time_s: 6920,
    total_elevation_gain_m: ft(412),
    average_speed_ms: paceToMs("8:09"),
    max_speed_ms: paceToMs("7:20"),
    average_heartrate: 148,
    max_heartrate: 166,
    has_heartrate: true,
    average_cadence: 176,
    calories: 1402,
    suffer_score: 96,
    gear_id: "g_novablast_4",
    map_id: "m09",
    summary_polyline: null,
    trainer: false,
    commute: false,
    manual: false,
    synced_at: "2026-04-13T16:00:00Z",
    created_at: "2026-04-13T16:00:00Z",
  },
  {
    id: 10_000_000_008,
    athlete_id: ATHLETE_ID,
    type: "Run",
    sport_type: "Run",
    name: "Easy Aerobic",
    start_date: "2026-04-11T14:02:00Z",
    start_date_local: "2026-04-11T07:02:00-07:00",
    timezone: "America/Los_Angeles",
    distance_m: mi(6.0),
    moving_time_s: 3000,
    elapsed_time_s: 3020,
    total_elevation_gain_m: ft(148),
    average_speed_ms: paceToMs("8:20"),
    max_speed_ms: paceToMs("7:40"),
    average_heartrate: 140,
    max_heartrate: 152,
    has_heartrate: true,
    average_cadence: 175,
    calories: 610,
    suffer_score: 30,
    gear_id: "g_endorphin_speed_4",
    map_id: "m08",
    summary_polyline: null,
    trainer: false,
    commute: false,
    manual: false,
    synced_at: "2026-04-11T15:00:00Z",
    created_at: "2026-04-11T15:00:00Z",
  },
  {
    id: 10_000_000_007,
    athlete_id: ATHLETE_ID,
    type: "Run",
    sport_type: "Run",
    name: "VO₂ — 6×800",
    start_date: "2026-04-10T12:45:00Z",
    start_date_local: "2026-04-10T05:45:00-07:00",
    timezone: "America/Los_Angeles",
    distance_m: mi(7.2),
    moving_time_s: 3060,
    elapsed_time_s: 3080,
    total_elevation_gain_m: ft(110),
    average_speed_ms: paceToMs("7:05"),
    max_speed_ms: paceToMs("6:20"),
    average_heartrate: 168,
    max_heartrate: 184,
    has_heartrate: true,
    average_cadence: 186,
    calories: 780,
    suffer_score: 138,
    gear_id: "g_endorphin_pro_4",
    map_id: "m07",
    summary_polyline: null,
    trainer: false,
    commute: false,
    manual: false,
    synced_at: "2026-04-10T14:00:00Z",
    created_at: "2026-04-10T14:00:00Z",
  },
  {
    id: 10_000_000_006,
    athlete_id: ATHLETE_ID,
    type: "Run",
    sport_type: "Run",
    name: "Easy + Strides",
    start_date: "2026-04-08T13:20:00Z",
    start_date_local: "2026-04-08T06:20:00-07:00",
    timezone: "America/Los_Angeles",
    distance_m: mi(5.5),
    moving_time_s: 2750,
    elapsed_time_s: 2760,
    total_elevation_gain_m: ft(135),
    average_speed_ms: paceToMs("8:20"),
    max_speed_ms: paceToMs("6:10"),
    average_heartrate: 141,
    max_heartrate: 172,
    has_heartrate: true,
    average_cadence: 178,
    calories: 560,
    suffer_score: 28,
    gear_id: "g_endorphin_speed_4",
    map_id: "m06",
    summary_polyline: null,
    trainer: false,
    commute: false,
    manual: false,
    synced_at: "2026-04-08T15:00:00Z",
    created_at: "2026-04-08T15:00:00Z",
  },
  {
    id: 10_000_000_005,
    athlete_id: ATHLETE_ID,
    type: "Run",
    sport_type: "Run",
    name: "Long — Hills",
    start_date: "2026-04-06T13:30:00Z",
    start_date_local: "2026-04-06T06:30:00-07:00",
    timezone: "America/Los_Angeles",
    distance_m: mi(13.0),
    moving_time_s: 6500,
    elapsed_time_s: 6520,
    total_elevation_gain_m: ft(680),
    average_speed_ms: paceToMs("8:20"),
    max_speed_ms: paceToMs("7:10"),
    average_heartrate: 150,
    max_heartrate: 170,
    has_heartrate: true,
    average_cadence: 174,
    calories: 1380,
    suffer_score: 120,
    gear_id: "g_novablast_4",
    map_id: "m05",
    summary_polyline: null,
    trainer: false,
    commute: false,
    manual: false,
    synced_at: "2026-04-06T16:00:00Z",
    created_at: "2026-04-06T16:00:00Z",
  },
];

// ============================================================
// GEAR — shoes
// ============================================================

export const GEAR: Gear[] = [
  {
    id: "g_endorphin_speed_4",
    athlete_id: ATHLETE_ID,
    name: "Endorphin Speed 4",
    brand_name: "Saucony",
    model_name: "Endorphin Speed 4",
    description: "Daily / Up-tempo",
    distance_m: mi(312),
    cap_m: mi(500),
    retired: false,
    primary_shoe: true,
    nickname: null,
    color: "#8EF542",
    purpose: "Daily / Up-tempo",
    last_run: "2026-04-17",
    synced_at: "2026-04-17T15:00:00Z",
  },
  {
    id: "g_endorphin_pro_4",
    athlete_id: ATHLETE_ID,
    name: "Endorphin Pro 4",
    brand_name: "Saucony",
    model_name: "Endorphin Pro 4",
    description: "Workouts / Race",
    distance_m: mi(148),
    cap_m: mi(350),
    retired: false,
    primary_shoe: false,
    nickname: null,
    color: "#6BA8E8",
    purpose: "Workouts / Race",
    last_run: "2026-04-16",
    synced_at: "2026-04-17T15:00:00Z",
  },
  {
    id: "g_novablast_4",
    athlete_id: ATHLETE_ID,
    name: "Novablast 4",
    brand_name: "Asics",
    model_name: "Novablast 4",
    description: "Long runs",
    distance_m: mi(428),
    cap_m: mi(500),
    retired: false,
    primary_shoe: false,
    nickname: null,
    color: "#E8B04D",
    purpose: "Long runs",
    last_run: "2026-04-13",
    synced_at: "2026-04-17T15:00:00Z",
  },
  {
    id: "g_cloudmonster_2",
    athlete_id: ATHLETE_ID,
    name: "Cloudmonster 2",
    brand_name: "On",
    model_name: "Cloudmonster 2",
    description: "Recovery",
    distance_m: mi(176),
    cap_m: mi(500),
    retired: false,
    primary_shoe: false,
    nickname: null,
    color: "#B18EE8",
    purpose: "Recovery",
    last_run: "2026-04-09",
    synced_at: "2026-04-17T15:00:00Z",
  },
  {
    id: "g_endorphin_speed_3",
    athlete_id: ATHLETE_ID,
    name: "Endorphin Speed 3",
    brand_name: "Saucony",
    model_name: "Endorphin Speed 3",
    description: "Retired",
    distance_m: mi(486),
    cap_m: mi(500),
    retired: true,
    primary_shoe: false,
    nickname: null,
    color: "#6B6B75",
    purpose: "Retired",
    last_run: "2025-12-28",
    synced_at: "2026-04-17T15:00:00Z",
  },
];

// ============================================================
// TRAINING PLAN
// ============================================================

export const PLAN: TrainingPlan = {
  id: PLAN_ID,
  athlete_id: ATHLETE_ID,
  name: "Mountain Lakes Marathon — Pfitz 18/70",
  start_date: "2026-02-09",
  end_date: "2026-06-21",
  goal_race_id: RACE_A,
  active: true,
  notes: null,
  created_at: "2026-02-01T00:00:00Z",
};

// 18-week plan, simplified to 14 rows (first 4 weeks elided for the burndown)
export const WEEK_MILEAGE: WeekMileage[] = [
  { week_number: 1, label: "W1", start_date: "2026-02-09", planned_m: mi(28), actual_m: mi(27.6) },
  { week_number: 2, label: "W2", start_date: "2026-02-16", planned_m: mi(32), actual_m: mi(33.1) },
  { week_number: 3, label: "W3", start_date: "2026-02-23", planned_m: mi(36), actual_m: mi(35.0) },
  { week_number: 4, label: "W4", start_date: "2026-03-02", planned_m: mi(24), actual_m: mi(24.2) },
  { week_number: 5, label: "W5", start_date: "2026-03-09", planned_m: mi(40), actual_m: mi(40.8) },
  { week_number: 6, label: "W6", start_date: "2026-03-16", planned_m: mi(44), actual_m: mi(43.1) },
  { week_number: 7, label: "W7", start_date: "2026-03-23", planned_m: mi(48), actual_m: mi(46.9) },
  { week_number: 8, label: "W8", start_date: "2026-03-30", planned_m: mi(30), actual_m: mi(29.0) },
  { week_number: 9, label: "W9", start_date: "2026-04-06", planned_m: mi(50), actual_m: mi(48.2) },
  { week_number: 10, label: "W10", start_date: "2026-04-13", planned_m: mi(54), actual_m: mi(42.3) }, // current
  { week_number: 11, label: "W11", start_date: "2026-04-20", planned_m: mi(56), actual_m: null },
  { week_number: 12, label: "W12", start_date: "2026-04-27", planned_m: mi(38), actual_m: null },
  { week_number: 13, label: "W13", start_date: "2026-05-04", planned_m: mi(26), actual_m: null }, // taper
  { week_number: 14, label: "W14", start_date: "2026-05-11", planned_m: mi(18), actual_m: null }, // race
];

export const CURRENT_WEEK_INDEX = 9; // 0-indexed, W10
export const TOTAL_WEEKS = 18;
export const TOTAL_MILES_PLANNED_M = mi(610);

// Planned runs for the current + next week (in DB shape)
export const PLANNED_RUNS: PlannedRun[] = [
  // Week 10 (current)
  {
    id: "p_w10_mon",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-13",
    workout_type: "long",
    target_distance_m: mi(14),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Long 14mi",
    notes: null,
    completed_activity_id: 10_000_000_009,
    completion_status: "completed",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w10_tue",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-14",
    workout_type: "recovery",
    target_distance_m: mi(4),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Recovery 4mi",
    notes: null,
    completed_activity_id: 10_000_000_010,
    completion_status: "completed",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w10_wed",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-15",
    workout_type: "rest",
    target_distance_m: 0,
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Rest or XT",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w10_thu",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-16",
    workout_type: "workout",
    target_distance_m: mi(8),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "4×1mi @ threshold, 400m jog",
    notes: null,
    completed_activity_id: 10_000_000_011,
    completion_status: "completed",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w10_fri",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-17",
    workout_type: "easy",
    target_distance_m: mi(5),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Easy 5mi",
    notes: null,
    completed_activity_id: 10_000_000_012,
    completion_status: "completed",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w10_sat",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-18",
    workout_type: "workout",
    target_distance_m: mi(10),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "2mi WU · 6mi @ MP (7:30) · 2mi CD",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w10_sun",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-19",
    workout_type: "long",
    target_distance_m: mi(16),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Long 16mi",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  // Week 11 (next)
  {
    id: "p_w11_mon",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-20",
    workout_type: "rest",
    target_distance_m: 0,
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Rest",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w11_tue",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-21",
    workout_type: "workout",
    target_distance_m: mi(9),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "6×1000 @ VO₂",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w11_wed",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-22",
    workout_type: "recovery",
    target_distance_m: mi(5),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Recovery 5mi",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w11_thu",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-23",
    workout_type: "easy",
    target_distance_m: mi(7),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Easy 7mi",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w11_fri",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-24",
    workout_type: "rest",
    target_distance_m: 0,
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Rest",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w11_sat",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-25",
    workout_type: "workout",
    target_distance_m: mi(12),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "3mi WU · 8mi @ HMP · 1mi CD",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
  {
    id: "p_w11_sun",
    plan_id: PLAN_ID,
    scheduled_date: "2026-04-26",
    workout_type: "race",
    target_distance_m: mi(6.2),
    target_duration_s: null,
    target_pace_s_per_km: null,
    description: "Forest Park 10K",
    notes: null,
    completed_activity_id: null,
    completion_status: "scheduled",
    created_at: "2026-02-09T00:00:00Z",
  },
];

// ============================================================
// RACES
// ============================================================

export const RACES: Race[] = [
  {
    id: RACE_A,
    athlete_id: ATHLETE_ID,
    name: "Mountain Lakes Marathon",
    race_date: "2026-06-21",
    distance_m: mi(26.2),
    location: "Portland, OR",
    goal_time_s: 3 * 3600 + 18 * 60,
    status: "upcoming",
    result_activity_id: null,
    plan_id: PLAN_ID,
    notes: null,
    created_at: "2026-02-01T00:00:00Z",
    priority: "A-race",
    confidence: 78,
  },
  {
    id: RACE_B,
    athlete_id: ATHLETE_ID,
    name: "Shoreline Half",
    race_date: "2026-05-10",
    distance_m: mi(13.1),
    location: "Seaside, OR",
    goal_time_s: 1 * 3600 + 32 * 60,
    status: "upcoming",
    result_activity_id: null,
    plan_id: PLAN_ID,
    notes: null,
    created_at: "2026-02-01T00:00:00Z",
    priority: "Tune-up",
    confidence: 86,
  },
  {
    id: RACE_C,
    athlete_id: ATHLETE_ID,
    name: "Forest Park 10K",
    race_date: "2026-04-26",
    distance_m: mi(6.2),
    location: "Portland, OR",
    goal_time_s: 42 * 60 + 30,
    status: "upcoming",
    result_activity_id: null,
    plan_id: PLAN_ID,
    notes: null,
    created_at: "2026-02-01T00:00:00Z",
    priority: "Tune-up",
    confidence: 91,
  },
  {
    id: RACE_D,
    athlete_id: ATHLETE_ID,
    name: "Gorge Half",
    race_date: "2025-11-16",
    distance_m: mi(13.1),
    location: "Hood River, OR",
    goal_time_s: null,
    status: "completed",
    result_activity_id: null,
    plan_id: null,
    notes: "1:34:22",
    created_at: "2025-09-01T00:00:00Z",
    priority: null,
    confidence: null,
  },
  {
    id: RACE_E,
    athlete_id: ATHLETE_ID,
    name: "Summer Trail 15K",
    race_date: "2025-08-02",
    distance_m: mi(9.3),
    location: "Bend, OR",
    goal_time_s: null,
    status: "completed",
    result_activity_id: null,
    plan_id: null,
    notes: "1:08:14",
    created_at: "2025-06-01T00:00:00Z",
    priority: null,
    confidence: null,
  },
];

// ============================================================
// HR Zones — current week distribution
// ============================================================

export const HR_ZONES: HRZone[] = [
  { zone: "Z1", label: "Recover", bpm_range: "< 130", minutes: 4, pct: 7 },
  { zone: "Z2", label: "Aerobic", bpm_range: "130–148", minutes: 14, pct: 24 },
  { zone: "Z3", label: "Tempo", bpm_range: "149–162", minutes: 12, pct: 21 },
  { zone: "Z4", label: "Thresh", bpm_range: "163–175", minutes: 22, pct: 38 },
  { zone: "Z5", label: "VO₂", bpm_range: "176+", minutes: 6, pct: 10 },
];

// Daily training load for the last 28 days (synthetic)
export const DAILY_LOAD_28: number[] = [
  0, 38, 0, 52, 28, 0, 88, 0, 42, 64, 0, 30, 0, 96, 22, 44, 0, 58, 34, 0, 92, 24, 48, 0, 62, 38, 0, 72,
];

// ============================================================
// ACTIVITY STREAMS (for the threshold workout detail page)
// ============================================================

export const HR_CURVE: number[] = Array.from({ length: 58 }, (_, i) => {
  const t = i / 58;
  const base = 120 + 30 * Math.min(1, t * 3);
  const intervals = i > 10 && i % 12 < 6 && i > 12 && i < 54 ? 26 : 0;
  const noise = Math.sin(i * 0.9) * 3;
  return Math.round(base + intervals + noise);
});

export const PACE_CURVE: number[] = Array.from({ length: 58 }, (_, i) => {
  const t = i / 58;
  const base = 8.4 - t * 0.4;
  const intervals = i > 10 && i % 12 < 6 && i > 12 && i < 54 ? -1.3 : 0;
  const noise = Math.sin(i * 1.3) * 0.06;
  return Math.max(6.2, base + intervals + noise);
});

export const SPLITS = [
  { mi: 1, pace: "7:42", hr: 148, elev_ft: 22 },
  { mi: 2, pace: "7:08", hr: 166, elev_ft: 14 },
  { mi: 3, pace: "7:02", hr: 170, elev_ft: -4 },
  { mi: 4, pace: "7:56", hr: 158, elev_ft: 18 },
  { mi: 5, pace: "7:04", hr: 172, elev_ft: 12 },
  { mi: 6, pace: "7:58", hr: 156, elev_ft: 22 },
  { mi: 7, pace: "7:06", hr: 174, elev_ft: 20 },
  { mi: 8, pace: "7:40", hr: 160, elev_ft: 32 },
  { mi: 8.3, pace: "7:22", hr: 152, elev_ft: 8, partial: true },
];

// Stylized route — points in [0..1, 0..1] space
export const ROUTE_POINTS: [number, number][] = (() => {
  const pts: [number, number][] = [];
  const N = 140;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = 0.1 + 0.8 * (0.5 + 0.45 * Math.sin(t * Math.PI * 2.1 + 0.3));
    const y =
      0.85 -
      0.72 * (0.5 + 0.45 * Math.sin(t * Math.PI * 1.3 + 1.2)) +
      Math.sin(t * 18) * 0.01;
    pts.push([x, y]);
  }
  return pts;
})();

// ============================================================
// AI coach analysis for the threshold workout
// ============================================================

export const COACH: RunAnalysis = {
  activity_id: 10_000_000_011,
  model: "claude-sonnet-4-6",
  prompt_version: "v1",
  summary: "Workout executed cleanly. Final rep held form under fatigue.",
  feedback_jsonb: {
    pacing:
      "Target pace for threshold today was 7:05/mi. You hit 7:08, 7:02, 7:04, 7:06 — 2-second spread across four reps. That's tight.",
    effort:
      "HR drift across the reps was +6bpm (166 → 172), which is normal for a warm morning and not a red flag. Recovery jogs averaged 9:20 — a touch quick; aim for 9:45 next time so you arrive at rep 4 with more in the tank.",
    plan_adherence:
      "This is the third threshold session this block and pace has dropped ~4 seconds at the same HR. Fitness is trending. Sunday's 16 is the next pressure test — treat it conservative the first half.",
    recovery_recommendation:
      "Easy 5mi tomorrow at 140 HR or below. Keep the long run on Sunday honest but not hard.",
    flags: [
      { kind: "positive", text: "Pace discipline across reps" },
      { kind: "positive", text: "Threshold fitness improving" },
      { kind: "note", text: "Shorten recovery jogs by ~20s" },
    ],
  },
  plan_adherence_score: 96,
  tokens_used: 1240,
  generated_at: "2026-04-16T14:10:00Z",
};

// ============================================================
// Long-term stats (for the Stats page)
// ============================================================

export const STATS_MONTHLY = [
  { label: "Nov", miles: 108, runs: 18 },
  { label: "Dec", miles: 142, runs: 22 },
  { label: "Jan", miles: 168, runs: 25 },
  { label: "Feb", miles: 186, runs: 24 },
  { label: "Mar", miles: 212, runs: 26 },
  { label: "Apr", miles: 148, runs: 18 },
];

export const PACE_TREND_12W: number[] = Array.from(
  { length: 12 },
  (_, i) => 8.7 - i * 0.04 + Math.sin(i) * 0.05
);

export const RESTING_HR_12W: number[] = Array.from(
  { length: 12 },
  (_, i) => 52 - i * 0.25 + Math.sin(i * 0.9) * 1.2
);
