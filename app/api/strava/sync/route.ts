import { NextResponse, type NextRequest } from "next/server";
import { backfillActivities, syncGear } from "@/lib/strava/sync";
import { backfillAllWhoop } from "@/lib/whoop/sync";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";

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
  if (!athlete) return NextResponse.json({ error: "no_athlete" }, { status: 404 });

  const out: { inserted?: number; whoop?: object; error?: string } = {};
  try {
    const { inserted } = await backfillActivities(athlete.id as string, 14 / 365);
    await syncGear(athlete.id as string);
    out.inserted = inserted;
  } catch (e) {
    out.error = `strava: ${String(e)}`;
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

  return NextResponse.json({ ok: true, ...out });
}
