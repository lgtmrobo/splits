import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { matchPlannedRunsForAthlete } from "@/lib/plan/matching";
import {
  backfillActivities,
  backfillDetails,
  syncGear,
} from "@/lib/strava/sync";
import { backfillAllWhoop } from "@/lib/whoop/sync";
import { getCurrentAthleteId } from "@/lib/auth/athlete";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

// User-triggered sync. Same work as /api/cron/sync but scoped to the
// currently-logged-in athlete and authed via Supabase session rather
// than CRON_SECRET.
export async function POST(_req: NextRequest) {
  // Resolves the signed-in athlete, or the single athlete under
  // DEV_AUTH_BYPASS (where there is no session to read a user from).
  let athleteId: string;
  try {
    athleteId = await getCurrentAthleteId();
  } catch (e) {
    const unauth = String(e).includes("unauth");
    return NextResponse.json(
      { error: unauth ? "unauth" : "no_athlete" },
      { status: unauth ? 401 : 404 },
    );
  }
  const athlete = { id: athleteId };

  const out: {
    inserted?: number;
    whoop?: object;
    matched?: { linked: number; marked_missed: number };
    error?: string;
  } = {};
  try {
    const { inserted } = await backfillActivities(
      athlete.id as string,
      14 / 365,
    );
    await syncGear(athlete.id as string);
    await backfillDetails(athlete.id as string);
    out.inserted = inserted;
  } catch (e) {
    out.error = `strava: ${String(e)}`;
  }

  // Link freshly-ingested activities to scheduled planned runs so charts
  // that read `planned_runs.completed_activity_id` (Plan vs Actual mileage,
  // Plan Adherence) reflect the new data on the next render.
  try {
    out.matched = await matchPlannedRunsForAthlete(athlete.id as string);
  } catch (e) {
    out.error = `${out.error ?? ""} match: ${String(e)}`.trim();
  }

  const { data: tok } = await createServiceRoleSupabase()
    .from("whoop_tokens")
    .select("athlete_id")
    .eq("athlete_id", athlete.id)
    .maybeSingle();
  if (tok) {
    try {
      out.whoop = await backfillAllWhoop(athlete.id as string, 7);
    } catch (e) {
      out.error = `${out.error ?? ""} whoop: ${String(e)}`.trim();
    }
  }

  // Invalidate every route's server cache so charts on Dashboard, Stats,
  // Plan, Activities, Shoes, etc. all re-fetch on the client's next
  // router.refresh().
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, ...out });
}
