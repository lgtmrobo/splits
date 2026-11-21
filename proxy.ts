import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { allowedEmails, isAllowedEmail } from "@/lib/auth/allowlist";

// Paths that don't require auth
const PUBLIC_PATHS = [
  "/login",
  "/connect-strava",
  "/api/auth",
  "/api/strava/auth",
  "/api/strava/webhook",
  "/api/cron",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dev bypass: explicit opt-in via DEV_AUTH_BYPASS=true (local only),
  // OR, outside production, if auth isn't configured (e.g. `pnpm dev:mock`).
  // A production deploy missing that config fails closed instead of open.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.DEV_AUTH_BYPASS === "true") return NextResponse.next();
  if (!supabaseUrl || !supabaseAnonKey || allowedEmails().length === 0) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Splits isn't configured — see README setup.", {
      status: 503,
    });
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // A refreshed session is written to both the request (so this
        // render sees it) and the response (so the browser keeps it).
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Defense in depth — the auth callback already enforces this, but check
  // again in case cookies outlived an env change.
  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login?error=unauthorized", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Match everything except static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
