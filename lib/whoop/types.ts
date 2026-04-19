// WHOOP API types — only what we use, not exhaustive.

export interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: "bearer";
}

export interface WhoopUser {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface WhoopRecoveryScore {
  user_calibrating: boolean;
  recovery_score: number;          // 0–100
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage?: number;
  skin_temp_celsius?: number;
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE" | "NO_DATA";
  score?: WhoopRecoveryScore;
}

export interface WhoopCycleScore {
  strain: number;                  // 0–21
  kilojoule: number;
  average_heart_rate: number;
  max_heart_rate: number;
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  start: string;
  end: string | null;
  score_state: string;
  score?: WhoopCycleScore;
}

export interface WhoopZoneDuration {
  zone_zero_milli?: number;
  zone_one_milli?: number;
  zone_two_milli?: number;
  zone_three_milli?: number;
  zone_four_milli?: number;
  zone_five_milli?: number;
}

export interface WhoopWorkoutScore {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
  zone_duration: WhoopZoneDuration;
}

export interface WhoopWorkout {
  id: number;
  user_id: number;
  start: string;
  end: string;
  sport_id: number;
  sport_name?: string;
  score_state: string;
  score?: WhoopWorkoutScore;
}

export interface WhoopPage<T> {
  records: T[];
  next_token: string | null;
}
