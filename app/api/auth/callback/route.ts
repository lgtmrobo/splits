import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=nocode", req.url));
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=session", req.url));
  }

  // Email allowlist check — single-user lockdown
  const allowed = process.env.ALLOWED_EMAIL;
  if (!allowed || data.user.email !== allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  // If the user hasn't connected Strava yet, route them there.
  // We detect this by checking whether an athlete row + token row exist.
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, strava_tokens(access_token)")
    .eq("supabase_user_id", data.user.id)
    .maybeSingle();

  const connected =
    !!athlete &&
    Array.isArray(
      (athlete as unknown as { strava_tokens: unknown[] }).strava_tokens
    ) &&
    (athlete as unknown as { strava_tokens: unknown[] }).strava_tokens.length > 0;

  return NextResponse.redirect(new URL(connected ? "/" : "/connect-strava", req.url));
}
