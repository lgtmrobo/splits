// Minimal Strava API type definitions. Full spec is bigger; we only type
// what we read. Expand as needed.

export interface StravaTokenResponse {
  token_type: "Bearer";
  expires_at: number; // unix seconds
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: StravaAthlete;
}

export interface StravaAthlete {
  id: number;
  firstname: string | null;
  lastname: string | null;
  profile: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface StravaSummaryActivity {
  id: number;
  athlete: { id: number };
  name: string;
  type: string;
  sport_type: string;
  start_date: string; // ISO UTC
  start_date_local: string; // ISO local
  timezone: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed: number | null; // m/s
  max_speed: number | null;
  average_heartrate?: number;
  max_heartrate?: number;
  has_heartrate: boolean;
  average_cadence?: number;
  calories?: number;
  suffer_score?: number;
  gear_id: string | null;
  map: { id: string; summary_polyline: string | null; polyline?: string | null } | null;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
}

export interface StravaGear {
  id: string;
  primary: boolean;
  name: string;
  nickname?: string;
  resource_state: number;
  retired: boolean;
  distance: number; // meters
  brand_name: string | null;
  model_name: string | null;
  description: string | null;
}

// Webhook event payload
export interface StravaWebhookEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  updates?: Record<string, string>;
  owner_id: number;
  subscription_id: number;
  event_time: number; // unix seconds
}

// Stream keys we care about
export type StravaStreamKey =
  | "time"
  | "heartrate"
  | "latlng"
  | "altitude"
  | "velocity_smooth"
  | "cadence"
  | "distance"
  | "grade_smooth";

export interface StravaStream {
  type: StravaStreamKey;
  data: number[] | [number, number][];
  series_type: string;
  original_size: number;
  resolution: string;
}
