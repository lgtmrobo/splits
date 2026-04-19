import { stravaFetch } from "@/lib/strava/client";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import type {
  StravaGear,
  StravaStream,
  StravaStreamKey,
  StravaSummaryActivity,
} from "@/lib/strava/types";

// Activity types we ingest. Keep broad; filter at display time.
const ALLOWED_TYPES = new Set(["Run", "TrailRun"]);

/**
 * Map a Strava summary activity to our DB row shape.
 */
function mapActivity(a: StravaSummaryActivity, athleteId: string) {
  return {
    id: a.id,
    athlete_id: athleteId,
    type: a.type,
    sport_type: a.sport_type,
    name: a.name,
    start_date: a.start_date,
    start_date_local: a.start_date_local,
    timezone: a.timezone,
    distance_m: a.distance,
    moving_time_s: a.moving_time,
    elapsed_time_s: a.elapsed_time,
    total_elevation_gain_m: a.total_elevation_gain,
    average_speed_ms: a.average_speed,
    max_speed_ms: a.max_speed,
    average_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    has_heartrate: a.has_heartrate,
    average_cadence: a.average_cadence ?? null,
    calories: a.calories ?? null,
    suffer_score: a.suffer_score ?? null,
    gear_id: a.gear_id,
    map_id: a.map?.id ?? null,
    summary_polyline: a.map?.summary_polyline || a.map?.polyline || null,
    trainer: a.trainer,
    commute: a.commute,
    manual: a.manual,
    raw_jsonb: a,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Backfill: paginate /athlete/activities back `years` years.
 * Do NOT fetch streams during backfill — too expensive. Streams are
 * fetched lazily when the user opens an activity detail page.
 */
export async function backfillActivities(athleteId: string, years = 2) {
  const supabase = createServiceRoleSupabase();
  const after = Math.floor((Date.now() - years * 365 * 24 * 60 * 60 * 1000) / 1000);
  const perPage = 200;
  let page = 1;
  let totalInserted = 0;

  for (;;) {
    const batch = await stravaFetch<StravaSummaryActivity[]>(
      athleteId,
      `/athlete/activities?after=${after}&per_page=${perPage}&page=${page}`
    );
    if (batch.length === 0) break;

    const rows = batch.filter((a) => ALLOWED_TYPES.has(a.type)).map((a) => mapActivity(a, athleteId));
    if (rows.length > 0) {
      const { error } = await supabase.from("activities").upsert(rows, {
        onConflict: "id",
        ignoreDuplicates: false,
      });
      if (error) throw error;
      totalInserted += rows.length;
    }

    if (batch.length < perPage) break;
    page += 1;
  }
  return { inserted: totalInserted };
}

/**
 * Fetch a single activity (for webhook create/update events).
 */
export async function upsertActivity(athleteId: string, activityId: number) {
  const supabase = createServiceRoleSupabase();
  const a = await stravaFetch<StravaSummaryActivity>(
    athleteId,
    `/activities/${activityId}`
  );
  if (!ALLOWED_TYPES.has(a.type)) return { skipped: true as const };
  const row = mapActivity(a, athleteId);
  const { error } = await supabase.from("activities").upsert(row, {
    onConflict: "id",
  });
  if (error) throw error;
  return { skipped: false as const, row };
}

/**
 * Delete an activity (webhook delete event).
 */
export async function deleteActivity(activityId: number) {
  const supabase = createServiceRoleSupabase();
  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);
  if (error) throw error;
}

/**
 * Lazy-fetch streams for an activity. Stores in `activity_streams` so we
 * only pay for it once.
 */
export async function fetchActivityStreams(
  athleteId: string,
  activityId: number
) {
  const supabase = createServiceRoleSupabase();
  const keys: StravaStreamKey[] = [
    "time",
    "heartrate",
    "latlng",
    "altitude",
    "velocity_smooth",
    "cadence",
    "distance",
    "grade_smooth",
  ];
  const raw = await stravaFetch<unknown>(
    athleteId,
    `/activities/${activityId}/streams?keys=${keys.join(",")}&key_by_type=true`
  );

  const byType = new Map<string, { data: unknown }>();
  if (Array.isArray(raw)) {
    for (const s of raw as StravaStream[]) byType.set(s.type, { data: s.data });
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, { data: unknown }>)) {
      byType.set(k, v);
    }
  }

  const row = {
    activity_id: activityId,
    time_data: (byType.get("time")?.data as number[]) ?? null,
    heartrate_data: (byType.get("heartrate")?.data as number[]) ?? null,
    latlng_data: (byType.get("latlng")?.data as [number, number][]) ?? null,
    altitude_data: (byType.get("altitude")?.data as number[]) ?? null,
    velocity_smooth_data: (byType.get("velocity_smooth")?.data as number[]) ?? null,
    cadence_data: (byType.get("cadence")?.data as number[]) ?? null,
    distance_data: (byType.get("distance")?.data as number[]) ?? null,
    grade_smooth_data: (byType.get("grade_smooth")?.data as number[]) ?? null,
    fetched_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("activity_streams").upsert(row, {
    onConflict: "activity_id",
  });
  if (error) throw error;
  return row;
}

/**
 * Sync gear (shoes) for the athlete. Strava returns gear refs on activities
 * but full details come from /gear/{id}.
 */
export async function syncGear(athleteId: string) {
  const supabase = createServiceRoleSupabase();
  const { data: existing } = await supabase
    .from("activities")
    .select("gear_id")
    .eq("athlete_id", athleteId)
    .not("gear_id", "is", null);

  const ids = new Set<string>();
  for (const r of existing ?? []) if (r.gear_id) ids.add(r.gear_id as string);

  for (const id of ids) {
    const g = await stravaFetch<StravaGear>(athleteId, `/gear/${id}`);
    await supabase.from("gear").upsert(
      {
        id: g.id,
        athlete_id: athleteId,
        name: g.name,
        brand_name: g.brand_name,
        model_name: g.model_name,
        description: g.description,
        distance_m: g.distance,
        retired: g.retired,
        primary_shoe: g.primary,
        nickname: g.nickname ?? null,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  }
}
