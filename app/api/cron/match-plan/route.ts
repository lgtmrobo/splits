import { NextResponse, type NextRequest } from "next/server";
import { matchPlannedRunsForAthlete } from "@/lib/plan/matching";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

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
  const { data: athletes } = await admin.from("athletes").select("id");
  const results = [] as Array<{
    athlete_id: string;
    linked: number;
    marked_missed: number;
  }>;
  for (const a of athletes ?? []) {
    const r = await matchPlannedRunsForAthlete(a.id as string);
    results.push({ athlete_id: a.id as string, ...r });
  }
  const linked = results.reduce((s, r) => s + r.linked, 0);
  const marked_missed = results.reduce((s, r) => s + r.marked_missed, 0);

  return NextResponse.json({ ok: true, linked, marked_missed, results });
}

export const GET = POST;
