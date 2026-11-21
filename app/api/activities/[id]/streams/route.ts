import { NextResponse, type NextRequest } from "next/server";
import { fetchActivityStreams } from "@/lib/strava/sync";
import { getCurrentAthleteId } from "@/lib/auth/athlete";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

interface Context {
  params: Promise<{ id: string }>;
}

// GET: return cached streams if we have them, else fetch + cache.
export async function GET(_req: NextRequest, { params }: Context) {
  let athleteId: string;
  try {
    athleteId = await getCurrentAthleteId();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const activityId = Number((await params).id);
  const force = _req.nextUrl.searchParams.get("force") === "1";
  const admin = createServiceRoleSupabase();

  // Only the owner may read or fetch an activity's streams.
  const { data: activity } = await admin
    .from("activities")
    .select("athlete_id")
    .eq("id", activityId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (!activity) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Cache hit?
  if (!force) {
    const { data: cached } = await admin
      .from("activity_streams")
      .select("*")
      .eq("activity_id", activityId)
      .maybeSingle();
    if (cached) return NextResponse.json(cached);
  }

  // Miss — fetch from Strava and cache.
  try {
    const row = await fetchActivityStreams(
      athleteId,
      activityId
    );
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json(
      { error: "strava_fetch_failed", detail: String(e) },
      { status: 502 }
    );
  }
}
