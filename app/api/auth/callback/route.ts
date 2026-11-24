import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=nocode", req.url));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=session", req.url));
  }

  // Email allowlist check (ALLOWED_EMAILS)
  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  // Route to Strava connect only if this user hasn't connected yet. Tokens
  // are service-role only (RLS has no policy on strava_tokens), so the
  // user's own session can't see them — check with the admin client.
  const admin = createServiceRoleSupabase();
  const { data: athlete } = await admin
    .from("athletes")
    .select("id")
    .eq("supabase_user_id", data.user.id)
    .maybeSingle();
  const { data: token } = athlete
    ? await admin
        .from("strava_tokens")
        .select("athlete_id")
        .eq("athlete_id", athlete.id)
        .maybeSingle()
    : { data: null };
  const connected = !!token;

  return NextResponse.redirect(new URL(connected ? "/" : "/connect-strava", req.url));
}
