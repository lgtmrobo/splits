"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAthleteId } from "@/lib/auth/athlete";
import { readRace } from "@/lib/races/form";
import { syncTriathlonHistory } from "@/lib/races/sync";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export type AddRaceState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok" };

export async function addRace(_prev: AddRaceState, form: FormData): Promise<AddRaceState> {
  const race = await readRace(form);
  if (race === null) return { status: "error", message: "Give the race a name." };
  if (typeof race === "string") return { status: "error", message: race };

  let athleteId: string;
  try {
    athleteId = await getCurrentAthleteId();
  } catch {
    return { status: "error", message: "Sign in again to add a race." };
  }

  const { error } = await createServiceRoleSupabase()
    .from("races")
    .insert({ athlete_id: athleteId, status: "upcoming", ...race });
  if (error) {
    console.error("[races] insert failed", error);
    return { status: "error", message: "Couldn't save the race. Try again in a moment." };
  }

  await syncTriathlonHistory(athleteId, race.race_type);

  revalidatePath("/races");
  revalidatePath("/plan");
  revalidatePath("/", "layout");
  return { status: "ok" };
}
