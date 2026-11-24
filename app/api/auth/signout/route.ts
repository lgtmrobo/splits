import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Form POST from the avatar menu. 303 so the browser follows with a GET.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
