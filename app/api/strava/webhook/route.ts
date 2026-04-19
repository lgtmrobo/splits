import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { deleteActivity, upsertActivity } from "@/lib/strava/sync";
import type { StravaWebhookEvent } from "@/lib/strava/types";

// Strava webhook handshake: expects echoing hub.challenge
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (
    mode !== "subscribe" ||
    token !== process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ||
    !challenge
  ) {
    return NextResponse.json({ error: "verification_failed" }, { status: 403 });
  }
  return NextResponse.json({ "hub.challenge": challenge });
}

// Strava requires a 200 within ~2s. We persist the event and return
// immediately — actual processing happens lazily on view + via nightly cron.
export async function POST(req: NextRequest) {
  let event: StravaWebhookEvent;
  try {
    event = (await req.json()) as StravaWebhookEvent;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const admin = createServiceRoleSupabase();

  // Resolve the athlete by Strava athlete ID
  const { data: athlete } = await admin
    .from("athletes")
    .select("id")
    .eq("strava_athlete_id", event.owner_id)
    .maybeSingle();

  if (!athlete) {
    // Unknown athlete — still 200 so Strava doesn't retry
    return NextResponse.json({ ok: true, skipped: "unknown_athlete" });
  }

  // Do just enough to be idempotent and fast. For create/update we upsert
  // the activity row only; streams + AI analysis happen on demand.
  try {
    if (event.object_type === "activity") {
      if (event.aspect_type === "create" || event.aspect_type === "update") {
        await upsertActivity(athlete.id, event.object_id);
      } else if (event.aspect_type === "delete") {
        await deleteActivity(event.object_id);
      }
    } else if (event.object_type === "athlete") {
      if (event.updates?.authorized === "false") {
        // Revoked — delete tokens so getValidStravaToken will fail loudly
        await admin.from("strava_tokens").delete().eq("athlete_id", athlete.id);
      }
    }
  } catch (e) {
    // Log but still 200 — Strava retries aggressively and we don't want
    // dupes. Missed events get picked up by the nightly cron reconcile.
    console.error("[strava webhook] processing failed", e);
  }

  return NextResponse.json({ ok: true });
}
