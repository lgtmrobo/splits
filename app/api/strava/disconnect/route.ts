import { NextResponse, type NextRequest } from "next/server";
import { getValidStravaToken } from "@/lib/strava/client";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
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

  // Deauth at Strava first (best effort), then wipe tokens locally
  try {
    const token = await getValidStravaToken(athlete.id);
    await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.warn("[strava disconnect] deauth failed (continuing)", e);
  }

  await admin.from("strava_tokens").delete().eq("athlete_id", athlete.id);
  return NextResponse.json({ ok: true });
}
