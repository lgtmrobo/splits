import { NextResponse, type NextRequest } from "next/server";
import { fetchActivityStreams } from "@/lib/strava/sync";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";

interface Context {
  params: { id: string };
}

// GET: return cached streams if we have them, else fetch + cache.
export async function GET(_req: NextRequest, { params }: Context) {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const activityId = Number(params.id);
  const admin = createServiceRoleSupabase();

  // Cache hit?
  const { data: cached } = await admin
    .from("activity_streams")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();
  if (cached) return NextResponse.json(cached);

  // Miss — find the owning athlete, fetch, cache.
  const { data: activity } = await admin
    .from("activities")
    .select("athlete_id")
    .eq("id", activityId)
    .single();
  if (!activity) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const row = await fetchActivityStreams(
      (activity as { athlete_id: string }).athlete_id,
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
