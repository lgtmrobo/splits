import { createServiceRoleSupabase } from "@/lib/supabase/server";
import type { StravaTokenResponse } from "@/lib/strava/types";

const STRAVA_BASE = "https://www.strava.com/api/v3";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const REFRESH_BUFFER_SECONDS = 5 * 60; // refresh 5min before expiry

function stravaEnv() {
  const client_id = process.env.STRAVA_CLIENT_ID;
  const client_secret = process.env.STRAVA_CLIENT_SECRET;
  if (!client_id || !client_secret) {
    throw new Error("STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET not set");
  }
  return { client_id, client_secret };
}

/**
 * Exchange an authorization code for tokens during the OAuth flow.
 * Called once, in the OAuth callback handler.
 */
export async function exchangeCodeForToken(
  code: string
): Promise<StravaTokenResponse> {
  const { client_id, client_secret } = stravaEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id,
      client_secret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as StravaTokenResponse;
}

/**
 * Refresh an expired access token. Returns the new token payload.
 */
export async function refreshAccessToken(
  refresh_token: string
): Promise<StravaTokenResponse> {
  const { client_id, client_secret } = stravaEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id,
      client_secret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed: ${res.status} ${text}`);
  }
  return (await res.json()) as StravaTokenResponse;
}

/**
 * Fetch a fresh access token for the given athlete, refreshing if needed
 * and persisting rotated tokens back to the DB.
 */
export async function getValidStravaToken(athleteId: string): Promise<string> {
  const supabase = createServiceRoleSupabase();
  const { data: row, error } = await supabase
    .from("strava_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("athlete_id", athleteId)
    .single();

  if (error || !row) {
    throw new Error(`No Strava tokens for athlete ${athleteId}`);
  }

  const expiresAtMs = new Date(row.expires_at as string).getTime();
  const now = Date.now();
  const needsRefresh = expiresAtMs - now < REFRESH_BUFFER_SECONDS * 1000;

  if (!needsRefresh) return row.access_token as string;

  const fresh = await refreshAccessToken(row.refresh_token as string);
  await supabase
    .from("strava_tokens")
    .update({
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      expires_at: new Date(fresh.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("athlete_id", athleteId);

  return fresh.access_token;
}

/**
 * Token-aware fetch wrapper. Calls Strava with a valid token,
 * reads rate-limit headers so callers can back off gracefully.
 */
export async function stravaFetch<T = unknown>(
  athleteId: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getValidStravaToken(athleteId);
  const url = path.startsWith("http") ? path : `${STRAVA_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // Log rate limit headers — do NOT hardcode values, Strava tunes them.
  const limit = res.headers.get("X-RateLimit-Limit");
  const usage = res.headers.get("X-RateLimit-Usage");
  if (limit && usage) {
    // Shape: "200,2000" — 15-min,daily. Warn when the 15-min usage > 80%.
    const [short, long] = limit.split(",").map(Number);
    const [shortUsed, longUsed] = usage.split(",").map(Number);
    if (shortUsed / short > 0.8 || longUsed / long > 0.8) {
      console.warn(
        `[strava] approaching rate limit — short ${shortUsed}/${short} · long ${longUsed}/${long}`
      );
    }
  }

  if (res.status === 429) {
    throw new Error("strava_rate_limited");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava ${res.status} ${path}: ${text}`);
  }
  return (await res.json()) as T;
}
