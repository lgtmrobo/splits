import { createServiceRoleSupabase } from "@/lib/supabase/server";

const DAY_MS = 86_400_000;

/**
 * Earliest moment we sync data for this athlete, in epoch ms. `null` means
 * full history (the owner); invited athletes get their connect time, so
 * only activities from then on are ever pulled in.
 */
export async function historyFromMs(athleteId: string): Promise<number | null> {
  const { data, error } = await createServiceRoleSupabase()
    .from("athletes")
    .select("history_from")
    .eq("id", athleteId)
    .maybeSingle();
  if (error) throw error;
  const from = data?.history_from as string | null | undefined;
  return from ? new Date(from).getTime() : null;
}

/** Clamp a "last N days" window so it never reaches before `fromMs`. */
export function clampDays(days: number, fromMs: number | null): number {
  if (fromMs === null) return days;
  const sinceFrom = Math.ceil((Date.now() - fromMs) / DAY_MS);
  return Math.max(0, Math.min(days, sinceFrom));
}
