"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAthleteId } from "@/lib/auth/athlete";
import {
  blockEndDate,
  parsePlanCsv,
  splitAtToday,
  type PlannedRunInput,
} from "@/lib/plan/csv";
import { matchPlannedRunsForAthlete } from "@/lib/plan/matching";
import { readRace, type RaceInput } from "@/lib/races/form";
import { syncTriathlonHistory } from "@/lib/races/sync";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { todayLocalISO } from "@/lib/utils/dates";

const MAX_CSV_BYTES = 256 * 1024;
const MAX_NAME_LENGTH = 100;

export type ImportPlanState =
  | { status: "idle" }
  | { status: "error"; message: string; details?: string[] }
  | { status: "ok"; planId: string; imported: number };

interface ValidForm {
  name: string;
  rows: PlannedRunInput[];
  race: RaceInput | null;
  /** An existing race picked from the list, rather than a new one. */
  raceId: string | null;
}

type Admin = ReturnType<typeof createServiceRoleSupabase>;

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function fail(message: string, details?: string[]): ImportPlanState {
  return { status: "error", message, details };
}

/** Name + CSV + race, validated. Returns an error state on any problem. */
async function readForm(form: FormData): Promise<ValidForm | ImportPlanState> {
  const name = text(form, "name");
  if (!name) return fail("Give the block a name.");
  if (name.length > MAX_NAME_LENGTH) return fail("Block name is too long.");

  const file = form.get("csv");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV file.");
  if (file.size > MAX_CSV_BYTES) return fail("That file is too big for a training block.");

  // race_choice: "" = no race, "new" = the fields below, else a race id.
  const choice = text(form, "race_choice");
  const race = choice ? await readRace(form) : null;
  if (typeof race === "string") return fail(race);
  if (choice && !race) return fail("Give the race a name.");
  const raceId = choice && choice !== "new" ? choice : null;

  const { rows, errors } = parsePlanCsv(await file.text());
  if (errors.length > 0) {
    return fail(
      "Some rows couldn't be read. Fix them and upload again — nothing was changed.",
      errors.slice(0, 20),
    );
  }
  if (rows.length === 0) return fail("The CSV has no workouts in it.");
  return { name, rows, race, raceId };
}

/** New block, or (mode=replace) a replacement schedule for an existing one. */
export async function importPlan(
  _prev: ImportPlanState,
  form: FormData,
): Promise<ImportPlanState> {
  const parsed = await readForm(form);
  if ("status" in parsed) return parsed;

  let athleteId: string;
  try {
    athleteId = await getCurrentAthleteId();
  } catch {
    return fail("Connect Strava before importing a plan.");
  }

  const replacing = text(form, "mode") === "replace";
  try {
    const result = replacing
      ? await replaceBlock(athleteId, text(form, "plan_id"), parsed)
      : await insertBlock(athleteId, parsed);
    if ("status" in result) return result;

    try {
      // Link any already-synced runs from the last two weeks.
      await matchPlannedRunsForAthlete(athleteId);
    } catch (e) {
      console.error("[plan import] matching failed", e);
    }
    if (parsed.race) await syncTriathlonHistory(athleteId, parsed.race.race_type);
    revalidatePlanViews();
    return { status: "ok", ...result };
  } catch (e) {
    console.error("[plan import] save failed", e);
    return fail("Couldn't save the plan. Try again in a moment.");
  }
}

/** Delete a block and its planned workouts. Runs and races are untouched. */
export async function deletePlan(planId: string): Promise<void> {
  const athleteId = await getCurrentAthleteId();
  const { error } = await createServiceRoleSupabase()
    .from("training_plans")
    .delete()
    .eq("id", planId)
    .eq("athlete_id", athleteId);
  if (error) throw new Error(error.message);
  revalidatePlanViews();
}

function revalidatePlanViews() {
  revalidatePath("/plan");
  revalidatePath("/races");
  revalidatePath("/");
}

/** Race → plan → planned runs. Rolls back what it created if a step fails. */
async function insertBlock(
  athleteId: string,
  { name, rows, race, raceId: pickedRaceId }: ValidForm,
): Promise<{ planId: string; imported: number } | ImportPlanState> {
  const admin = createServiceRoleSupabase();
  const dates = rows.map((r) => r.scheduled_date).sort();
  if (pickedRaceId) {
    const problem = await claimRace(admin, athleteId, pickedRaceId, null);
    if (problem) return problem;
  }
  // A picked race existed before this upload, so a failure leaves it alone.
  let createdRaceId: string | null = null;
  let raceId: string | null = pickedRaceId;
  let planId: string | null = null;

  try {
    if (race && !pickedRaceId) raceId = createdRaceId = await insertRace(admin, athleteId, race);

    const { data: plan, error: planErr } = await admin
      .from("training_plans")
      .insert({
        athlete_id: athleteId,
        name,
        start_date: dates[0],
        end_date: blockEndDate(dates, race?.race_date),
        goal_race_id: raceId,
        active: true,
      })
      .select("id")
      .single();
    if (planErr) throw planErr;
    planId = plan.id as string;

    if (raceId) {
      const { error } = await admin
        .from("races")
        .update(pickedRaceId && race ? { ...race, plan_id: planId } : { plan_id: planId })
        .eq("id", raceId);
      if (error) throw error;
    }

    const { error: runsErr } = await admin
      .from("planned_runs")
      .insert(rows.map((r) => ({ ...r, plan_id: planId })));
    if (runsErr) throw runsErr;

    return { planId, imported: rows.length };
  } catch (e) {
    // planned_runs cascade with the plan; a picked race's link clears with it.
    if (planId) await admin.from("training_plans").delete().eq("id", planId);
    if (createdRaceId) await admin.from("races").delete().eq("id", createdRaceId);
    throw e;
  }
}

async function insertRace(admin: Admin, athleteId: string, race: RaceInput): Promise<string> {
  const { data, error } = await admin
    .from("races")
    .insert({ athlete_id: athleteId, status: "upcoming", ...race })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Swap today-onward for the CSV's rows; days before today (and which runs
 * completed them) stay as recorded. Restores the old schedule on failure.
 */
async function replaceBlock(
  athleteId: string,
  planId: string,
  { name, rows, race, raceId: pickedRaceId }: ValidForm,
): Promise<{ planId: string; imported: number } | ImportPlanState> {
  const admin = createServiceRoleSupabase();
  const { data: plan, error: planErr } = await admin
    .from("training_plans")
    .select("id, goal_race_id")
    .eq("id", planId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (planErr) throw planErr;
  if (!plan) return fail("That block no longer exists.");
  if (pickedRaceId) {
    const problem = await claimRace(admin, athleteId, pickedRaceId, planId);
    if (problem) return problem;
  }

  const today = todayLocalISO();
  const { future } = splitAtToday(rows, today);
  if (future.length === 0) {
    return fail(
      "No workouts dated today or later. Past days are kept as they are, so only today onward can be replaced.",
    );
  }

  const { data: snapshot, error: snapErr } = await admin
    .from("planned_runs")
    .select("*")
    .eq("plan_id", planId)
    .gte("scheduled_date", today);
  if (snapErr) throw snapErr;

  const { error: delErr } = await admin
    .from("planned_runs")
    .delete()
    .eq("plan_id", planId)
    .gte("scheduled_date", today);
  if (delErr) throw delErr;

  const { error: insErr } = await admin
    .from("planned_runs")
    .insert(future.map((r) => ({ ...r, plan_id: planId })));
  if (insErr) {
    if (snapshot?.length) await admin.from("planned_runs").insert(snapshot);
    throw insErr;
  }

  const raceId = await syncGoalRace(
    admin,
    athleteId,
    planId,
    plan.goal_race_id as string | null,
    race,
    pickedRaceId,
  );
  const [first, last] = await planDateRange(admin, planId);
  const { error: updErr } = await admin
    .from("training_plans")
    .update({
      name,
      start_date: first,
      end_date: blockEndDate([last], race?.race_date),
      goal_race_id: raceId,
    })
    .eq("id", planId);
  if (updErr) throw updErr;

  return { planId, imported: future.length };
}

/** Update, add, swap or unlink the block's goal race to match the form. */
async function syncGoalRace(
  admin: Admin,
  athleteId: string,
  planId: string,
  currentRaceId: string | null,
  race: RaceInput | null,
  pickedRaceId: string | null,
): Promise<string | null> {
  // A different race (or none): unlink the old one but keep it on the Races page.
  if (currentRaceId && currentRaceId !== pickedRaceId) {
    await admin.from("races").update({ plan_id: null }).eq("id", currentRaceId);
  }
  if (!race) return null;
  if (pickedRaceId) {
    const { error } = await admin
      .from("races")
      .update({ ...race, plan_id: planId })
      .eq("id", pickedRaceId)
      .eq("athlete_id", athleteId);
    if (error) throw error;
    return pickedRaceId;
  }
  const raceId = await insertRace(admin, athleteId, race);
  const { error } = await admin.from("races").update({ plan_id: planId }).eq("id", raceId);
  if (error) throw error;
  return raceId;
}

/**
 * Check a picked race can be this block's goal: it's the athlete's own and
 * not already another block's goal. Returns an error state, or null if ok.
 */
async function claimRace(
  admin: Admin,
  athleteId: string,
  raceId: string,
  planId: string | null,
): Promise<ImportPlanState | null> {
  const { data, error } = await admin
    .from("races")
    .select("id, plan_id")
    .eq("id", raceId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return fail("That race no longer exists.");
  if (data.plan_id && data.plan_id !== planId) {
    return fail("That race already has a training block. Pick another race or add a new one.");
  }
  return null;
}

async function planDateRange(admin: Admin, planId: string): Promise<[string, string]> {
  const edge = async (ascending: boolean) => {
    const { data, error } = await admin
      .from("planned_runs")
      .select("scheduled_date")
      .eq("plan_id", planId)
      .order("scheduled_date", { ascending })
      .limit(1)
      .single();
    if (error) throw error;
    return data.scheduled_date as string;
  };
  return [await edge(true), await edge(false)];
}
