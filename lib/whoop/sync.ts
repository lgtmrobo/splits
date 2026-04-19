import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { whoopFetch } from "@/lib/whoop/client";
import type {
  WhoopCycle,
  WhoopPage,
  WhoopRecovery,
  WhoopWorkout,
} from "@/lib/whoop/types";

/** Backfill recovery for the last `days` days. */
export async function backfillRecovery(athleteId: string, days = 30) {
  const sb = createServiceRoleSupabase();
  const start = new Date(Date.now() - days * 86400_000).toISOString();
  let next: string | null = null;
  let total = 0;

  do {
    const params = new URLSearchParams({ start, limit: "25" });
    if (next) params.set("nextToken", next);
    const page: WhoopPage<WhoopRecovery> = await whoopFetch(
      athleteId,
      `/v2/recovery?${params.toString()}`
    );
    const rows = page.records
      .filter((r) => r.score_state === "SCORED" && r.score)
      .map((r) => ({
        athlete_id: athleteId,
        date: new Date(r.created_at).toISOString().slice(0, 10),
        cycle_id: r.cycle_id,
        sleep_id: r.sleep_id,
        recovery_score: r.score?.recovery_score ?? null,
        resting_heart_rate: r.score?.resting_heart_rate ?? null,
        hrv_rmssd_milli: r.score?.hrv_rmssd_milli ?? null,
        spo2_percentage: r.score?.spo2_percentage ?? null,
        skin_temp_celsius: r.score?.skin_temp_celsius ?? null,
        user_calibrating: r.score?.user_calibrating ?? false,
        raw_jsonb: r,
        synced_at: new Date().toISOString(),
      }));
    if (rows.length) {
      const { error } = await sb.from("whoop_recovery").upsert(rows, {
        onConflict: "athlete_id,date",
      });
      if (error) throw error;
      total += rows.length;
    }
    next = page.next_token;
  } while (next);

  return { recovery: total };
}

/** Backfill cycles for the last `days` days. */
export async function backfillCycles(athleteId: string, days = 30) {
  const sb = createServiceRoleSupabase();
  const start = new Date(Date.now() - days * 86400_000).toISOString();
  let next: string | null = null;
  let total = 0;

  do {
    const params = new URLSearchParams({ start, limit: "25" });
    if (next) params.set("nextToken", next);
    const page: WhoopPage<WhoopCycle> = await whoopFetch(
      athleteId,
      `/v1/cycle?${params.toString()}`
    );
    const rows = page.records.map((c) => ({
      id: c.id,
      athlete_id: athleteId,
      start_at: c.start,
      end_at: c.end,
      strain: c.score?.strain ?? null,
      kilojoule: c.score?.kilojoule ?? null,
      average_heart_rate: c.score?.average_heart_rate ?? null,
      max_heart_rate: c.score?.max_heart_rate ?? null,
      raw_jsonb: c,
      synced_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await sb.from("whoop_cycles").upsert(rows, { onConflict: "id" });
      if (error) throw error;
      total += rows.length;
    }
    next = page.next_token;
  } while (next);

  return { cycles: total };
}

/** Backfill workouts and match each to a Strava activity by start time (±10 min). */
export async function backfillWorkouts(athleteId: string, days = 30) {
  const sb = createServiceRoleSupabase();
  const start = new Date(Date.now() - days * 86400_000).toISOString();
  let next: string | null = null;
  let total = 0;
  const collected: WhoopWorkout[] = [];

  do {
    const params = new URLSearchParams({ start, limit: "25" });
    if (next) params.set("nextToken", next);
    const page: WhoopPage<WhoopWorkout> = await whoopFetch(
      athleteId,
      `/v2/activity/workout?${params.toString()}`
    );
    collected.push(...page.records);
    next = page.next_token;
  } while (next);

  // Pull recent activities once for matching.
  const activityWindowStart = new Date(Date.now() - (days + 1) * 86400_000).toISOString();
  const { data: acts } = await sb
    .from("activities")
    .select("id, start_date")
    .eq("athlete_id", athleteId)
    .gte("start_date", activityWindowStart);

  const findMatch = (whoopStart: string): number | null => {
    const t = new Date(whoopStart).getTime();
    let best: { id: number; diff: number } | null = null;
    for (const a of acts ?? []) {
      const diff = Math.abs(new Date(a.start_date).getTime() - t);
      if (diff <= 10 * 60 * 1000 && (!best || diff < best.diff)) {
        best = { id: Number(a.id), diff };
      }
    }
    return best?.id ?? null;
  };

  const rows = collected.map((w) => ({
    id: w.id,
    athlete_id: athleteId,
    start_at: w.start,
    end_at: w.end,
    sport_name: w.sport_name ?? null,
    strain: w.score?.strain ?? null,
    average_heart_rate: w.score?.average_heart_rate ?? null,
    max_heart_rate: w.score?.max_heart_rate ?? null,
    zone_zero_ms: w.score?.zone_durations?.zone_zero_milli ?? null,
    zone_one_ms: w.score?.zone_durations?.zone_one_milli ?? null,
    zone_two_ms: w.score?.zone_durations?.zone_two_milli ?? null,
    zone_three_ms: w.score?.zone_durations?.zone_three_milli ?? null,
    zone_four_ms: w.score?.zone_durations?.zone_four_milli ?? null,
    zone_five_ms: w.score?.zone_durations?.zone_five_milli ?? null,
    matched_activity_id: findMatch(w.start),
    raw_jsonb: w,
    synced_at: new Date().toISOString(),
  }));

  if (rows.length) {
    const { error } = await sb.from("whoop_workouts").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    total = rows.length;
  }
  return { workouts: total };
}

/** Run the full WHOOP backfill (recovery + cycles + workouts). */
export async function backfillAllWhoop(athleteId: string, days = 30) {
  const r = await backfillRecovery(athleteId, days);
  const c = await backfillCycles(athleteId, days);
  const w = await backfillWorkouts(athleteId, days);
  return { ...r, ...c, ...w };
}
