import { NextResponse, type NextRequest } from "next/server";
import { milesToMeters, pacePerMileToSecPerKm } from "@/lib/utils/units";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import type { WorkoutType } from "@/lib/types";

// CSV schema:
// date (YYYY-MM-DD), workout_type, target_distance_mi, target_pace_per_mi, description
// Example:
// 2026-04-13,long,14,,Long 14mi
// 2026-04-16,workout,8,7:05,4x1mi @ threshold

const VALID_TYPES: WorkoutType[] = [
  "easy",
  "tempo",
  "interval",
  "long",
  "recovery",
  "rest",
  "race",
  "workout",
];

export async function POST(req: NextRequest) {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const form = await req.formData();
  const planName = (form.get("name") as string) || "Imported plan";
  const file = form.get("csv") as File | null;
  if (!file) return NextResponse.json({ error: "no_file" }, { status: 400 });

  const text = await file.text();
  const lines = text.trim().split(/\r?\n/);
  // Allow optional header row
  const startAt = lines[0]?.toLowerCase().includes("date") ? 1 : 0;

  interface PlannedInput {
    scheduled_date: string;
    workout_type: WorkoutType;
    target_distance_m: number | null;
    target_pace_s_per_km: number | null;
    description: string | null;
  }

  const rows: PlannedInput[] = [];
  const errors: string[] = [];

  for (let i = startAt; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [date, type, distMi, pace, desc] = line
      .split(",")
      .map((s) => s.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`row ${i + 1}: bad date "${date}"`);
      continue;
    }
    const wt = type.toLowerCase() as WorkoutType;
    if (!VALID_TYPES.includes(wt)) {
      errors.push(`row ${i + 1}: unknown workout_type "${type}"`);
      continue;
    }
    rows.push({
      scheduled_date: date,
      workout_type: wt,
      target_distance_m: distMi ? milesToMeters(Number(distMi)) : null,
      target_pace_s_per_km: pace ? pacePerMileToSecPerKm(pace) : null,
      description: desc || null,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "no_valid_rows", errors },
      { status: 400 }
    );
  }

  // Resolve athlete
  const admin = createServiceRoleSupabase();
  const { data: athlete } = await admin
    .from("athletes")
    .select("id")
    .eq("supabase_user_id", user.id)
    .single();
  if (!athlete) return NextResponse.json({ error: "no_athlete" }, { status: 404 });

  // Create the plan row
  const sorted = [...rows].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const { data: plan, error: planErr } = await admin
    .from("training_plans")
    .insert({
      athlete_id: athlete.id,
      name: planName,
      start_date: sorted[0].scheduled_date,
      end_date: sorted[sorted.length - 1].scheduled_date,
      active: true,
    })
    .select("id")
    .single();
  if (planErr || !plan) {
    return NextResponse.json(
      { error: "plan_create_failed", detail: planErr },
      { status: 500 }
    );
  }

  const plannedRows = rows.map((r) => ({ ...r, plan_id: plan.id }));
  const { error: runsErr } = await admin.from("planned_runs").insert(plannedRows);
  if (runsErr) {
    return NextResponse.json(
      { error: "planned_runs_insert_failed", detail: runsErr },
      { status: 500 }
    );
  }

  return NextResponse.json({
    plan_id: plan.id,
    imported: rows.length,
    errors,
  });
}
