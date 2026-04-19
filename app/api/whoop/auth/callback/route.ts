import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForToken } from "@/lib/whoop/client";
import { backfillAllWhoop } from "@/lib/whoop/sync";
import { createServerSupabase, createServiceRoleSupabase, isDevAuthBypass } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL("/connect-strava?whoop=denied", req.url));
  if (!code) return NextResponse.redirect(new URL("/connect-strava?whoop=nocode", req.url));

  const admin = createServiceRoleSupabase();

  // Find the athlete: prefer the logged-in user; in dev bypass, take the only row.
  let athleteId: string | null = null;
  if (isDevAuthBypass()) {
    const { data } = await admin.from("athletes").select("id").limit(1);
    athleteId = data?.[0]?.id ?? null;
  } else {
    const authed = createServerSupabase();
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/login", req.url));
    const { data } = await admin
      .from("athletes")
      .select("id")
      .eq("supabase_user_id", user.id)
      .maybeSingle();
    athleteId = data?.id ?? null;
  }
  if (!athleteId) {
    return NextResponse.redirect(new URL("/connect-strava?whoop=no_athlete", req.url));
  }

  let tokens;
  try {
    tokens = await exchangeCodeForToken(code);
  } catch (e) {
    console.error("[whoop] token exchange failed", e);
    return NextResponse.redirect(new URL("/connect-strava?whoop=exchange_failed", req.url));
  }

  const { error: tokErr } = await admin.from("whoop_tokens").upsert(
    {
      athlete_id: athleteId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id" }
  );
  if (tokErr) {
    return NextResponse.json({ error: "whoop_token_store_failed", detail: tokErr }, { status: 500 });
  }

  // Fire-and-forget 30-day backfill.
  Promise.resolve().then(async () => {
    try {
      await backfillAllWhoop(athleteId!, 30);
    } catch (e) {
      console.error("[whoop] backfill failed", e);
    }
  });

  return NextResponse.redirect(new URL("/?whoop=connected", req.url));
}
