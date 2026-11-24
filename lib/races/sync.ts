import { backfillActivities } from "@/lib/strava/sync";
import { isTriathlon, type RaceType } from "@/lib/races/types";

/**
 * Pull in the last year of swims and rides after a triathlon race is added
 * (sync only keeps them for athletes with one). Strava's list endpoint
 * returns 200 activities per call, so this is a handful of requests. A
 * failure is logged rather than failing the save; new swims and rides
 * still arrive through the webhook and regular syncs.
 */
export async function syncTriathlonHistory(athleteId: string, raceType: RaceType) {
  if (!isTriathlon(raceType)) return;
  try {
    await backfillActivities(athleteId, 1);
  } catch (e) {
    console.error("[races] triathlon backfill failed", e);
  }
}
