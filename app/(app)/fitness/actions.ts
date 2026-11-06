"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAthleteId } from "@/lib/auth/athlete";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { M_PER_KM, M_PER_MILE } from "@/lib/utils/units";

export interface ThresholdFormState {
  ok: boolean;
  error: string | null;
}

// Mirrors the check constraints in supabase/migrations/00013_fitness.sql.
const LIMITS = {
  lthr: [100, 220],
  resting_hr: [25, 110],
  max_hr: [120, 230],
  pace_s_per_mi: [195, 965], // 3:15–16:05 /mi ≈ 120–600 s/km
} as const;

class FieldError extends Error {}

function parseIntField(raw: FormDataEntryValue | null, label: string, [lo, hi]: readonly [number, number]): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) throw new FieldError(`${label} must be a whole number.`);
  const n = Number(s);
  if (n < lo || n > hi) throw new FieldError(`${label} must be between ${lo} and ${hi}.`);
  return n;
}

/** "8:15" per mile → seconds per km. Blank → null (estimate instead). */
function parsePace(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) throw new FieldError("Threshold pace must look like 8:15 (min:sec per mile).");
  const secPerMile = Number(m[1]) * 60 + Number(m[2]);
  const [lo, hi] = LIMITS.pace_s_per_mi;
  if (secPerMile < lo || secPerMile > hi) throw new FieldError("Threshold pace looks out of range.");
  return Math.round((secPerMile / (M_PER_MILE / M_PER_KM)) * 10) / 10;
}

export async function saveThresholds(
  _prev: ThresholdFormState,
  form: FormData,
): Promise<ThresholdFormState> {
  let patch;
  try {
    patch = {
      threshold_pace_s_per_km: parsePace(form.get("pace")),
      lthr: parseIntField(form.get("lthr"), "Threshold HR", LIMITS.lthr),
      resting_hr: parseIntField(form.get("resting_hr"), "Resting HR", LIMITS.resting_hr),
      max_hr: parseIntField(form.get("max_hr"), "Max HR", LIMITS.max_hr),
    };
  } catch (e) {
    if (e instanceof FieldError) return { ok: false, error: e.message };
    throw e;
  }
  if (patch.lthr != null && patch.max_hr != null && patch.lthr >= patch.max_hr) {
    return { ok: false, error: "Threshold HR must be below max HR." };
  }
  if (patch.lthr != null && patch.resting_hr != null && patch.resting_hr >= patch.lthr) {
    return { ok: false, error: "Resting HR must be below threshold HR." };
  }

  try {
    const athleteId = await getCurrentAthleteId();
    const { error } = await createServiceRoleSupabase()
      .from("athletes")
      .update(patch)
      .eq("id", athleteId);
    if (error) throw error;
  } catch (e) {
    console.error("[saveThresholds] update failed:", e);
    return { ok: false, error: "Couldn't save thresholds — try again." };
  }

  revalidatePath("/fitness");
  revalidatePath("/stats");
  return { ok: true, error: null };
}
