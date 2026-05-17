import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { matchPlannedRunsForAthlete } from "@/lib/plan/matching";
import {
  backfillActivities,
  backfillPolylines,
  syncGear,
} from "@/lib/strava/sync";
import { backfillAllWhoop } from "@/lib/whoop/sync";
import {
  createServerSupabase,
  createServiceRoleSupabase,
} from "@/lib/supabase/server";

// User-triggered sync. Same work as /api/cron/sync but scoped to the
// currently-logged-in athlete and authed via Supabase session rather
// than CRON_SECRET.
export async function POST(_req: NextRequest) {
  const authed = createServerSupabase();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const admin = createServiceRoleSupabase();
  const { data: athlete } = await admin
    .from("athletes")
    .select("id")
    .eq("supabase_user_id", user.id)
    .single();
  if (!athlete)
    return NextResponse.json({ error: "no_athlete" }, { status: 404 });

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
    await backfillPolylines(athlete.id as string);
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

  const { data: tok } = await admin
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
