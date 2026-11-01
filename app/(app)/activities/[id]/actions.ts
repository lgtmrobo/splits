"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAthleteId } from "@/lib/auth/athlete";
import { segmentMovingTimes } from "@/lib/gear/segments";
import { recomputeGearTotals } from "@/lib/strava/sync";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

const M_PER_MILE = 1609.344;
const MAX_SEGMENTS = 4;
// The last shoe gets whatever's left; it has to be at least this long.
const MIN_LAST_SEGMENT_M = 0.05 * M_PER_MILE;

export interface ShoeSplitPart {
  gear_id: string;
  /** Ignored for the last part, which takes the rest of the run. */
  miles: number;
}

async function ownedActivity(activityId: number, athleteId: string) {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("activities")
    .select("id, athlete_id, distance_m, moving_time_s")
    .eq("id", activityId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Activity not found");
  return data;
}

function revalidateShoeViews(activityId: number) {
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/activities");
  revalidatePath("/shoes");
  revalidatePath("/");
}

/**
 * Split one run across several shoes. Parts are in run order; every part
 * but the last gives its miles, and the last takes the remainder.
 */
export async function saveShoeSplit(
  activityId: number,
  parts: ShoeSplitPart[],
): Promise<void> {
  if (!Number.isInteger(activityId)) throw new Error("Bad activity id");
  if (parts.length < 2 || parts.length > MAX_SEGMENTS)
    throw new Error(`Split into 2–${MAX_SEGMENTS} shoes`);

  const athleteId = await getCurrentAthleteId();
  const admin = createServiceRoleSupabase();
  const activity = await ownedActivity(activityId, athleteId);
  const totalM = Number(activity.distance_m ?? 0);

  const gearIds = [...new Set(parts.map((p) => p.gear_id))];
  const { data: gear, error: gearErr } = await admin
    .from("gear")
    .select("id")
    .eq("athlete_id", athleteId)
    .in("id", gearIds);
  if (gearErr) throw new Error(gearErr.message);
  if ((gear ?? []).length !== gearIds.length) throw new Error("Unknown shoe");

  const leadingM = parts.slice(0, -1).map((p) => {
    if (!Number.isFinite(p.miles) || p.miles <= 0)
      throw new Error("Each shoe needs miles greater than 0");
    return p.miles * M_PER_MILE;
  });
  const lastM = totalM - leadingM.reduce((a, b) => a + b, 0);
  if (lastM < MIN_LAST_SEGMENT_M)
    throw new Error(
      `Miles add up to more than the run (${(totalM / M_PER_MILE).toFixed(2)} mi)`,
    );
  const segmentM = [...leadingM, lastM];

  const { data: streams } = await admin
    .from("activity_streams")
    .select("distance_data, time_data, velocity_smooth_data")
    .eq("activity_id", activityId)
    .maybeSingle();
  const times = segmentMovingTimes(
    segmentM,
    streams ?? null,
    Number(activity.moving_time_s ?? 0),
  );

  // Upsert then trim, so a failed write never leaves the run with no split.
  const { error: upErr } = await admin.from("activity_gear_segments").upsert(
    parts.map((p, i) => ({
      activity_id: activityId,
      seq: i,
      athlete_id: athleteId,
      gear_id: p.gear_id,
      distance_m: Math.round(segmentM[i] * 10) / 10,
      moving_time_s: times[i],
    })),
    { onConflict: "activity_id,seq" },
  );
  if (upErr) throw new Error(upErr.message);
  const { error: trimErr } = await admin
    .from("activity_gear_segments")
    .delete()
    .eq("activity_id", activityId)
    .gte("seq", parts.length);
  if (trimErr) throw new Error(trimErr.message);

  await recomputeGearTotals(athleteId);
  revalidateShoeViews(activityId);
}

/** Back to one shoe: the whole run counts toward its Strava gear again. */
export async function clearShoeSplit(activityId: number): Promise<void> {
  if (!Number.isInteger(activityId)) throw new Error("Bad activity id");
  const athleteId = await getCurrentAthleteId();
  await ownedActivity(activityId, athleteId);
  const { error } = await createServiceRoleSupabase()
    .from("activity_gear_segments")
    .delete()
    .eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  await recomputeGearTotals(athleteId);
  revalidateShoeViews(activityId);
}
