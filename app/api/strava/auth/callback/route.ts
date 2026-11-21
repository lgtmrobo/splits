import { NextResponse, type NextRequest } from "next/server";
import { isOwnerEmail } from "@/lib/auth/allowlist";
import { exchangeCodeForToken } from "@/lib/strava/client";
import { backfillActivities, syncGear } from "@/lib/strava/sync";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(new URL("/connect-strava?error=denied", req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/connect-strava?error=nocode", req.url));
  }

  const authed = await createServerSupabase();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const tokens = await exchangeCodeForToken(code);
  const admin = createServiceRoleSupabase();

  // Invited users start tracking from their first connect — no history
  // import. Set only when the athlete row is new, so a reconnect keeps the
  // original cutoff. The owner (first ALLOWED_EMAILS entry) gets full history.
  const { data: existing } = await admin
    .from("athletes")
    .select("id")
    .eq("supabase_user_id", user.id)
    .maybeSingle();
  const isOwner = isOwnerEmail(user.email);
  const historyFrom: { history_from?: string } =
    !existing && !isOwner ? { history_from: new Date().toISOString() } : {};

  // Upsert athlete (one row per supabase_user_id)
  const s = tokens.athlete;
  const athletePayload = {
    supabase_user_id: user.id,
    strava_athlete_id: s?.id ?? 0,
    email: user.email,
    first_name: s?.firstname ?? null,
    last_name: s?.lastname ?? null,
    profile_image_url: s?.profile ?? null,
    updated_at: new Date().toISOString(),
    ...historyFrom,
  };

  const { data: athlete, error: athErr } = await admin
    .from("athletes")
    .upsert(athletePayload, { onConflict: "supabase_user_id" })
    .select("id")
    .single();
  if (athErr || !athlete) {
    return NextResponse.json({ error: "athlete_upsert_failed", detail: athErr }, { status: 500 });
  }

  // Store tokens
  const { error: tokErr } = await admin.from("strava_tokens").upsert(
    {
      athlete_id: athlete.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      scope: req.nextUrl.searchParams.get("scope"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id" }
  );
  if (tokErr) {
    return NextResponse.json({ error: "token_store_failed", detail: tokErr }, { status: 500 });
  }

  // Fire-and-forget backfill — webhook is already set up at subscription time.
  // We don't `await` to avoid holding the redirect open; errors log to Vercel.
  // Only the owner gets the 2-year history; everyone else just gets gear.
  Promise.resolve().then(async () => {
    try {
      if (isOwner) await backfillActivities(athlete.id, 2);
      await syncGear(athlete.id);
    } catch (e) {
      console.error("[strava] backfill failed", e);
    }
  });

  return NextResponse.redirect(new URL("/", req.url));
}
