"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createServiceRoleSupabase, isDevAuthBypass, createServerSupabase } from "@/lib/supabase/server";

const M_PER_MILE = 1609.344;
const milesToM = (mi: number) => Math.round(mi * M_PER_MILE);

async function getCurrentAthleteId(): Promise<string> {
  const admin = createServiceRoleSupabase();
  if (isDevAuthBypass()) {
    const { data } = await admin.from("athletes").select("id").limit(1);
    if (!data?.[0]) throw new Error("No athlete row");
    return data[0].id;
  }
  const sb = createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("unauth");
  const { data } = await admin.from("athletes").select("id").eq("supabase_user_id", user.id).single();
  if (!data) throw new Error("athlete not found");
  return data.id;
}

export interface ShoePayload {
  id?: string;
  name: string;
  brand_name: string;
  model_name: string;
  description: string;
  miles: number;
  cap_miles: number;
  primary_shoe: boolean;
  retired: boolean;
}

export async function saveShoe(payload: ShoePayload) {
  const athleteId = await getCurrentAthleteId();
  const admin = createServiceRoleSupabase();
  const id = payload.id ?? `local_${randomBytes(8).toString("hex")}`;

  // Single primary at a time — clear the flag on others if this one's set
  if (payload.primary_shoe) {
    await admin.from("gear").update({ primary_shoe: false }).eq("athlete_id", athleteId);
  }

  const row = {
    id,
    athlete_id: athleteId,
    name: payload.name,
    brand_name: payload.brand_name || null,
    model_name: payload.model_name || null,
    description: payload.description || null,
    distance_m: milesToM(payload.miles),
    retired: payload.retired,
    primary_shoe: payload.primary_shoe,
    nickname: null,
    synced_at: new Date().toISOString(),
  };
  const { error } = await admin.from("gear").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);

  revalidatePath("/shoes");
  revalidatePath("/");
  revalidatePath("/activities");
}

export async function deleteShoe(id: string) {
  await getCurrentAthleteId();
  const admin = createServiceRoleSupabase();
  // Detach from any activities first (gear_id has no FK to gear in our schema,
  // but keep it tidy)
  await admin.from("activities").update({ gear_id: null }).eq("gear_id", id);
  const { error } = await admin.from("gear").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/shoes");
  revalidatePath("/");
  revalidatePath("/activities");
}
