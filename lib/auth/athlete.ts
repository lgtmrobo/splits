import {
  createServerSupabase,
  createServiceRoleSupabase,
  isDevAuthBypass,
} from "@/lib/supabase/server";

/**
 * The signed-in athlete's id, for server actions that write with the
 * service role. Throws if nobody is signed in.
 */
export async function getCurrentAthleteId(): Promise<string> {
  const admin = createServiceRoleSupabase();
  if (isDevAuthBypass()) {
    const { data } = await admin.from("athletes").select("id").limit(1);
    if (!data?.[0]) throw new Error("No athlete row");
    return data[0].id;
  }
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("unauth");
  const { data } = await admin
    .from("athletes")
    .select("id")
    .eq("supabase_user_id", user.id)
    .single();
  if (!data) throw new Error("athlete not found");
  return data.id;
}
