import { NextResponse, type NextRequest } from "next/server";
import { backfillActivities, backfillPolylines, syncGear } from "@/lib/strava/sync";
import { backfillAllWhoop } from "@/lib/whoop/sync";
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

  const results: Array<{ athlete_id: string; inserted?: number; whoop?: object; error?: string }> = [];
  for (const a of athletes) {
    const out: { athlete_id: string; inserted?: number; whoop?: object; error?: string } = { athlete_id: a.id as string };
    try {
      const { inserted } = await backfillActivities(a.id as string, 14 / 365);
      await syncGear(a.id as string);
      await backfillPolylines(a.id as string);
      out.inserted = inserted;
    } catch (e) {
      out.error = `strava: ${String(e)}`;
    }
    // WHOOP — only if connected
    const { data: tok } = await admin
      .from("whoop_tokens")
      .select("athlete_id")
      .eq("athlete_id", a.id)
      .maybeSingle();
    if (tok) {
      try {
        out.whoop = await backfillAllWhoop(a.id as string, 7);
      } catch (e) {
        out.error = `${out.error ?? ""} whoop: ${String(e)}`.trim();
      }
    }
    results.push(out);
  }
  return NextResponse.json({ ok: true, results });
}

// Allow GET too for manual curl-testing against the local server
export const GET = POST;
