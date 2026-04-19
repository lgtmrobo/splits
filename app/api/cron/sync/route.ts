import { NextResponse, type NextRequest } from "next/server";
import { backfillActivities, syncGear } from "@/lib/strava/sync";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"
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
  if (!athletes) return NextResponse.json({ ok: true, athletes: 0 });

  const results: Array<{ athlete_id: string; inserted?: number; error?: string }> = [];
  for (const a of athletes) {
    try {
      // Reconcile the last ~14 days — catches any missed webhooks.
      const { inserted } = await backfillActivities(a.id as string, 14 / 365);
      await syncGear(a.id as string);
      results.push({ athlete_id: a.id as string, inserted });
    } catch (e) {
      results.push({ athlete_id: a.id as string, error: String(e) });
    }
  }
  return NextResponse.json({ ok: true, results });
}

// Allow GET too for manual curl-testing against the local server
export const GET = POST;
