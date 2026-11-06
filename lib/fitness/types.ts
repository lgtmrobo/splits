import type { ThresholdOverrides } from "@/lib/fitness/thresholds";
import type { PlannedRun, Race } from "@/lib/types";

/** The slice of an activity the fitness model needs. */
export interface FitnessActivity {
  id: number;
  name: string;
  start_date_local: string;
  sport_type: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;
  total_elevation_gain_m: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  best_efforts: unknown;
}

/** Everything the fitness model reads, fetched in one go. */
export interface FitnessInputs {
  /** Athlete-local today (pinned in mock mode). */
  todayISO: string;
  activities: FitnessActivity[];
  /** Planned runs from today forward. */
  planned: PlannedRun[];
  upcomingRaces: Race[];
  overrides: ThresholdOverrides | null;
  /** Latest WHOOP resting HR, if connected. */
  restingHr: number | null;
}
