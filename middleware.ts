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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dev bypass: if Supabase isn't configured, everything is open.
  // Comment this block out once you have env vars wired up.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.ALLOWED_EMAIL
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
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
