// Domain types — shape matches the DB schema defined in
// supabase/migrations/00001_init.sql so that mock data and real
// Supabase queries are interchangeable.

export type UUID = string;

export interface Athlete {
  id: UUID;
  supabase_user_id: UUID | null;
  strava_athlete_id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

// "Run" | "Ride" | "Walk" | "Workout" — Strava's top-level type
export type StravaActivityType =
  | "Run"
  | "Ride"
  | "Walk"
  | "Hike"
  | "Workout"
  | "WeightTraining"
  | string;

// Strava's more specific sport_type, e.g. "Run" vs "TrailRun"
export type StravaSportType = string;

export interface Activity {
  id: number; // Strava activity ID
  athlete_id: UUID;
  type: StravaActivityType;
  sport_type: StravaSportType | null;
  name: string;
  start_date: string; // ISO UTC
  start_date_local: string; // ISO local
  timezone: string;
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s: number;
  total_elevation_gain_m: number | null;
  average_speed_ms: number | null;
  max_speed_ms: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  has_heartrate: boolean;
  average_cadence: number | null;
  calories: number | null;
  suffer_score: number | null;
  gear_id: string | null;
  map_id: string | null;
  summary_polyline: string | null;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  synced_at: string;
  created_at: string;
}

export interface ActivityStreams {
  activity_id: number;
  time_data: number[] | null; // seconds from start
  heartrate_data: number[] | null;
  latlng_data: [number, number][] | null;
  altitude_data: number[] | null;
  velocity_smooth_data: number[] | null; // m/s
  cadence_data: number[] | null;
  distance_data: number[] | null; // meters
  grade_smooth_data: number[] | null;
  fetched_at: string;
}

export interface Gear {
  id: string; // Strava gear ID
  athlete_id: UUID;
  name: string;
  brand_name: string | null;
  model_name: string | null;
  description: string | null;
  distance_m: number;
  retired: boolean;
  primary_shoe: boolean;
  nickname: string | null;
  // Derived / UI-only:
  color: string; // assigned client-side from a palette
  purpose: string; // derived from description or user-assigned
  cap_m: number; // retirement threshold (assigned per shoe)
  last_run: string | null; // ISO date
  synced_at: string;
}

export interface TrainingPlan {
  id: UUID;
  athlete_id: UUID;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  goal_race_id: UUID | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export type WorkoutType =
  | "easy"
  | "tempo"
  | "interval"
  | "long"
  | "recovery"
  | "rest"
  | "race"
  | "workout";

export type CompletionStatus = "scheduled" | "completed" | "missed" | "skipped";

export interface PlannedRun {
  id: UUID;
  plan_id: UUID;
  scheduled_date: string; // YYYY-MM-DD
  workout_type: WorkoutType;
  target_distance_m: number | null;
  target_duration_s: number | null;
  target_pace_s_per_km: number | null;
  description: string | null;
  notes: string | null;
  completed_activity_id: number | null;
  completion_status: CompletionStatus;
  created_at: string;
}

export interface RunAnalysisFeedback {
  pacing: string;
  effort: string;
  plan_adherence: string;
  recovery_recommendation: string;
  flags: Array<{ kind: "positive" | "note" | "warn"; text: string }>;
}

export interface RunAnalysis {
  activity_id: number;
  model: string;
  prompt_version: string;
  summary: string; // 2-3 sentence headline
  feedback_jsonb: RunAnalysisFeedback;
  plan_adherence_score: number | null; // 0-100
  tokens_used: number | null;
  generated_at: string;
}

export type RaceStatus = "upcoming" | "completed" | "cancelled" | "dnf";

export interface Race {
  id: UUID;
  athlete_id: UUID;
  name: string;
  race_date: string; // YYYY-MM-DD
  distance_m: number;
  location: string | null;
  goal_time_s: number | null;
  status: RaceStatus;
  result_activity_id: number | null;
  plan_id: UUID | null;
  notes: string | null;
  created_at: string;
  // Derived / UI-only:
  priority: "A-race" | "Tune-up" | null;
  confidence: number | null; // 0-100, computed from workouts
}

// ===== Aggregated / computed shapes used by the UI =====

export interface WeekMileage {
  week_number: number;
  label: string; // "W1" … "W14"
  start_date: string;
  planned_m: number;
  actual_m: number | null; // null = future
}

export interface HRZone {
  zone: "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
  label: string; // "Recover", "Aerobic", ...
  bpm_range: string; // "< 130", "130–148", ...
  minutes: number;
  pct: number;
}

export interface PlanWeekDay {
  day_short: string; // "Mon"
  date_label: string; // "Apr 13"
  date_iso: string; // YYYY-MM-DD
  planned: PlannedRun | null;
  actual: Activity | null;
  status: "done" | "today" | "upcoming" | "rest" | "missed";
}
