import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function isDevAuthBypass(): boolean {
  return process.env.DEV_AUTH_BYPASS === "true";
}

// Supabase-js issues its requests with plain `fetch`, which Next.js's App
// Router patches to cache by default (persisted to disk, surviving restarts).
// That silently froze rows like `activity_streams` at whatever they looked
// like on first read — e.g. missing, if a page rendered before the lazy
// stream fetch landed — so later writes never showed up. Force every
// Supabase request to bypass that cache; Supabase's own data is source of
// truth per-request, not something Next should cache on our behalf.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

/**
 * Session-scoped client for App Router server components / route handlers.
 * Uses the caller's cookies, so RLS policies apply.
 *
 * In local dev with DEV_AUTH_BYPASS=true, returns the service-role client
 * so pages can render without a logged-in user.
 */
export function createServerSupabase() {
  if (isDevAuthBypass()) return createServiceRoleSupabase();
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // `cookies().set` fails in Server Components — safe to ignore.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // same as above
          }
        },
      },
      global: { fetch: noStoreFetch },
    }
  );
}

/**
 * Admin client with service-role key — RLS bypassed.
 * Only use server-side in privileged routes (webhooks, cron, admin tooling).
 * NEVER ship this to the browser.
 */
export function createServiceRoleSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Service-role Supabase client requested but NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing."
    );
  }
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}
