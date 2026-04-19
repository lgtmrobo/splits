import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET() {
  const client_id = process.env.STRAVA_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!client_id || !appUrl) {
    return NextResponse.json(
      { error: "Strava env vars missing (STRAVA_CLIENT_ID, NEXT_PUBLIC_APP_URL)" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/strava/auth/callback`;
  const scope = "read,activity:read_all,profile:read_all";
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", scope);

  redirect(url.toString());
}
