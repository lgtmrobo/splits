import { createServiceRoleSupabase } from "@/lib/supabase/server";
import type { WhoopTokenResponse } from "@/lib/whoop/types";

const OAUTH_BASE = "https://api.prod.whoop.com/oauth/oauth2";
const API_BASE = "https://api.prod.whoop.com/developer";

function appUrl() {
  const u = process.env.NEXT_PUBLIC_APP_URL;
  if (!u) throw new Error("NEXT_PUBLIC_APP_URL not set");
  return u.replace(/\/$/, "");
}

export function whoopAuthUrl(state: string): string {
  const id = process.env.WHOOP_CLIENT_ID;
  if (!id) throw new Error("WHOOP_CLIENT_ID not set");
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: `${appUrl()}/api/whoop/auth/callback`,
    response_type: "code",
    scope: "read:recovery read:sleep read:cycles read:workout read:profile read:body_measurement offline",
    state,
  });
  return `${OAUTH_BASE}/auth?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<WhoopTokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code,
    redirect_uri: `${appUrl()}/api/whoop/auth/callback`,
  });
  const r = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`WHOOP token exchange failed: ${r.status} ${text}`);
  }
  return (await r.json()) as WhoopTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<WhoopTokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "offline",
  });
  const r = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`WHOOP token refresh failed: ${r.status} ${text}`);
  }
  return (await r.json()) as WhoopTokenResponse;
}

export async function getValidWhoopToken(athleteId: string): Promise<string> {
  const sb = createServiceRoleSupabase();
  const { data: tok, error } = await sb
    .from("whoop_tokens")
    .select("*")
    .eq("athlete_id", athleteId)
    .single();
  if (error || !tok) throw new Error("No WHOOP token for athlete — connect WHOOP first.");

  const expiresAt = new Date(tok.expires_at).getTime();
  if (expiresAt - 5 * 60 * 1000 > Date.now()) return tok.access_token as string;

  const refreshed = await refreshAccessToken(tok.refresh_token as string);
  await sb
    .from("whoop_tokens")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      scope: refreshed.scope,
      updated_at: new Date().toISOString(),
    })
    .eq("athlete_id", athleteId);
  return refreshed.access_token;
}

export async function whoopFetch<T>(athleteId: string, path: string, init?: RequestInit): Promise<T> {
  const token = await getValidWhoopToken(athleteId);
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const r = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (r.status === 429) throw new Error("WHOOP rate limit (429)");
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`WHOOP ${r.status} ${path}: ${text.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}
