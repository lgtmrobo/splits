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
 * Fill in `summary_polyline` for any recent activity that's still missing
 * one. The `/athlete/activities` list endpoint returns an empty polyline,
 * so we hit the detail endpoint per activity to pull the full encoded
 * route. Mirrors `scripts/backfill-polylines.mjs` but scoped to recent
 * rows so it's cheap enough to run after every sync.
 */
export async function backfillPolylines(athleteId: string, limit = 50) {
  const supabase = createServiceRoleSupabase();
  const { data: needs } = await supabase
    .from("activities")
    .select("id")
    .eq("athlete_id", athleteId)
    .or("summary_polyline.is.null,summary_polyline.eq.")
    .eq("trainer", false)
    .eq("manual", false)
    .order("start_date", { ascending: false })
    .limit(limit);

  let updated = 0;
  let skipped = 0;
  for (const a of needs ?? []) {
    try {
      const detail = await stravaFetch<StravaSummaryActivity>(
        athleteId,
        `/activities/${a.id}`
      );
      const poly = detail.map?.polyline || detail.map?.summary_polyline || null;
      if (!poly) {
        skipped++;
        continue;
      }
      await supabase
        .from("activities")
        .update({ summary_polyline: poly, map_id: detail.map?.id ?? null })
        .eq("id", a.id);
      updated++;
    } catch (e) {
      if (String(e).includes("strava_rate_limited")) break;
      skipped++;
    }
    // Stay well under Strava's 200 req / 15 min short-term limit.
    await new Promise((r) => setTimeout(r, 250));
  }
  return { updated, skipped };
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
 *
 * If a Strava gear matches a locally-added shoe by name+brand+model, we
 * merge: keep the local row's `cap_m`-equivalent metadata (currently only
 * `nickname` exists on the schema), prefer the higher distance, re-link
 * activities to the Strava id, and delete the local row.
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

  // Pull all locally-added shoes once for merge-by-name matching.
  const { data: localShoes } = await supabase
    .from("gear")
    .select("id, name, brand_name, model_name, distance_m, nickname, primary_shoe, retired")
    .eq("athlete_id", athleteId)
    .like("id", "local_%");

  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const matchKey = (g: { name?: string | null; brand_name?: string | null; model_name?: string | null }) =>
    `${norm(g.name)}|${norm(g.brand_name)}|${norm(g.model_name)}`;
  type LocalShoe = NonNullable<typeof localShoes>[number];
  const localByKey = new Map<string, LocalShoe>();
  for (const l of localShoes ?? []) localByKey.set(matchKey(l), l);

  for (const id of ids) {
    const g = await stravaFetch<StravaGear>(athleteId, `/gear/${id}`);
    const local = localByKey.get(matchKey(g));

    // Merge with local if matched.
    const mergedDistance =
      local && Number(local.distance_m ?? 0) > Number(g.distance ?? 0)
        ? Number(local.distance_m)
        : Number(g.distance);
    const mergedNickname = local?.nickname ?? g.nickname ?? null;

    await supabase.from("gear").upsert(
      {
        id: g.id,
        athlete_id: athleteId,
        name: g.name,
        brand_name: g.brand_name,
        model_name: g.model_name,
        description: g.description,
        distance_m: mergedDistance,
        retired: g.retired,
        primary_shoe: g.primary,
        nickname: mergedNickname,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (local && local.id !== g.id) {
      // Re-link any activities pointing at the old local id, then drop it.
      await supabase
        .from("activities")
        .update({ gear_id: g.id })
        .eq("athlete_id", athleteId)
        .eq("gear_id", local.id);
      await supabase.from("gear").delete().eq("id", local.id);
      console.log(`[gear] merged local shoe "${g.name}" (${local.id}) → Strava ${g.id}`);
    }
  }
}
