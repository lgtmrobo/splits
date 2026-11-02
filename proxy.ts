import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  // OR if Supabase env vars are missing.
  if (
    process.env.DEV_AUTH_BYPASS === "true" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.ALLOWED_EMAIL
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  if (user.email !== process.env.ALLOWED_EMAIL) {
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
