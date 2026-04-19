import { NextResponse, type NextRequest } from "next/server";
import { analyzeRun } from "@/lib/ai/analyze";
import { bestMatch } from "@/lib/plan/matching";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import type {
  Activity,
  HRZone,
  PlannedRun,
} from "@/lib/types";

interface Context {
  params: { id: string };
}

// GET → return cached analysis (or 404)
export async function GET(_req: NextRequest, { params }: Context) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("run_analyses")
    .select("*")
    .eq("activity_id", Number(params.id))
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

// POST → generate (or force regenerate with ?force=1)
export async function POST(req: NextRequest, { params }: Context) {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const force = req.nextUrl.searchParams.get("force") === "1";
  const admin = createServiceRoleSupabase();
  const activityId = Number(params.id);

  // Load activity + the last 5 for context
  const { data: activity } = await admin
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();
  if (!activity) return NextResponse.json({ error: "activity_not_found" }, { status: 404 });

  const { data: recent } = await admin
    .from("activities")
    .select("*")
    .eq("athlete_id", (activity as Activity).athlete_id)
    .lt("start_date", (activity as Activity).start_date)
    .order("start_date", { ascending: false })
    .limit(5);

  // Find a candidate planned run (±1 day) and run the matcher
  const dayBefore = (activity as Activity).start_date_local.slice(0, 10);
  const { data: candidates } = await admin
    .from("planned_runs")
    .select("*")
    .gte("scheduled_date", dayBefore)
    .lte(
      "scheduled_date",
      new Date(new Date(dayBefore).getTime() + 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10)
    );
  const matched = candidates
    ? bestMatch(activity as Activity, candidates as PlannedRun[])?.planned ?? null
    : null;

  // 14-day adherence
  const fourteenAgo = new Date(
    new Date((activity as Activity).start_date).getTime() - 14 * 24 * 3600 * 1000
  ).toISOString();
  const { data: adh } = await admin
    .from("planned_runs")
    .select("id, completion_status")
    .gte("scheduled_date", fourteenAgo.slice(0, 10))
    .lte("scheduled_date", dayBefore)
    .neq("workout_type", "rest");

  const planAdherence14d = adh
    ? {
        completed: (adh as Array<{ completion_status: string }>).filter(
          (r) => r.completion_status === "completed"
        ).length,
        total: adh.length,
      }
    : null;

  // Zones — we don't compute them yet, so pass an empty array for now.
  // When the streams pipeline is wired, compute zones from heartrate_data.
  const zones: HRZone[] = [];

  try {
    const analysis = await analyzeRun(
      {
        activity: activity as Activity,
        recent: (recent as Activity[]) ?? [],
        zones,
        matchedPlan: matched,
        planAdherence14d,
      },
      { force }
    );
    return NextResponse.json(analysis);
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e) },
      { status: 500 }
    );
  }
}
