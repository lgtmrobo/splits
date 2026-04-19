import { NextResponse, type NextRequest } from "next/server";
import { bestMatch, findMissedPlannedRuns } from "@/lib/plan/matching";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import type { Activity, PlannedRun } from "@/lib/types";

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  if (!header || !process.env.CRON_SECRET) return false;
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const admin = createServiceRoleSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const fourteenAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  // Pull unlinked activities from the last 14 days
  const { data: activities } = await admin
    .from("activities")
    .select("*")
    .gte("start_date_local", fourteenAgo);

  // Pull scheduled planned runs in overlapping window (±1 day buffer)
  const { data: planned } = await admin
    .from("planned_runs")
    .select("*")
    .gte("scheduled_date", fourteenAgo)
    .eq("completion_status", "scheduled");

  let linked = 0;
  if (activities && planned) {
    // Track which planned runs have been claimed during this pass
    const claimed = new Set<string>();
    for (const a of activities as Activity[]) {
      const candidates = (planned as PlannedRun[]).filter(
        (p) =>
          !claimed.has(p.id) &&
          Math.abs(
            new Date(p.scheduled_date).getTime() -
              new Date(a.start_date_local.slice(0, 10)).getTime()
          ) <=
            1 * 24 * 3600 * 1000
      );
      const m = bestMatch(a, candidates);
      if (!m) continue;
      claimed.add(m.planned.id);
      await admin
        .from("planned_runs")
        .update({
          completed_activity_id: a.id,
          completion_status: "completed",
        })
        .eq("id", m.planned.id);
      linked += 1;
    }
  }

  // Mark missed
  const missed = planned ? findMissedPlannedRuns(planned as PlannedRun[], today) : [];
  if (missed.length > 0) {
    await admin
      .from("planned_runs")
      .update({ completion_status: "missed" })
      .in("id", missed.map((m) => m.id));
  }

  return NextResponse.json({ ok: true, linked, marked_missed: missed.length });
}

export const GET = POST;
