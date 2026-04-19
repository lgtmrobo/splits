import { createServerSupabase } from "@/lib/supabase/server";
import { decodePolyline, normalizePoints } from "@/lib/strava/polyline";
import { addDaysISO, dayDiff, todayLocalISO } from "@/lib/utils/dates";
import type {
  Activity,
  ActivityStreams,
  Athlete,
  Gear,
  HRZone,
  PlannedRun,
  PlanWeekDay,
  Race,
  RunAnalysis,
  TrainingPlan,
  WeekMileage,
} from "@/lib/types";

const M_PER_MILE = 1609.344;
const M_PER_FT = 0.3048;

const GEAR_PALETTE = ["#8EF542", "#6BA8E8", "#E8B04D", "#B18EE8", "#F58EE8", "#8EF5E8"];

function pickGearColor(idx: number, retired: boolean) {
  if (retired) return "#6B6B75";
  return GEAR_PALETTE[idx % GEAR_PALETTE.length];
}

function defaultCapM(description: string | null): number {
  const d = (description ?? "").toLowerCase();
  if (d.includes("race")) return Math.round(350 * M_PER_MILE);
  if (d.includes("trail")) return Math.round(400 * M_PER_MILE);
  return Math.round(500 * M_PER_MILE);
}

// =========================================================================
// Athlete
// =========================================================================

export async function getCurrentAthlete(): Promise<Athlete> {
  const sb = createServerSupabase();
  const { data, error } = await sb.from("athletes").select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No athlete row for current user — connect Strava first.");
  return data as Athlete;
}

// =========================================================================
// Activities
// =========================================================================

export async function getRecentActivities(limit = 10): Promise<Activity[]> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("activities")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function getAllActivities(): Promise<Activity[]> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("activities")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function getActivityById(id: number | string): Promise<Activity | null> {
  const numId = typeof id === "string" ? Number(id) : id;
  const sb = createServerSupabase();
  const { data, error } = await sb.from("activities").select("*").eq("id", numId).maybeSingle();
  if (error) throw error;
  return (data as Activity) ?? null;
}

export async function getActivityTotals(): Promise<{
  count: number;
  distance_m: number;
  duration_s: number;
  distance_7d_m: number;
  distance_28d_m: number;
  distance_ytd_m: number;
  avg_pace_28d_ms: number;
  avg_hr_28d: number;
  elev_28d_m: number;
}> {
  const sb = createServerSupabase();
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const days = (n: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  };
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const { data, error } = await sb
    .from("activities")
    .select(
      "distance_m, moving_time_s, average_speed_ms, average_heartrate, total_elevation_gain_m, start_date"
    );
  if (error) throw error;
  const rows = data ?? [];

  let count = rows.length;
  let distance_m = 0;
  let duration_s = 0;
  let distance_7d_m = 0;
  let distance_28d_m = 0;
  let distance_ytd_m = 0;
  let speed_sum_28 = 0;
  let speed_n_28 = 0;
  let hr_sum_28 = 0;
  let hr_n_28 = 0;
  let elev_28 = 0;
  const since7 = iso(days(7));
  const since28 = iso(days(28));
  const sinceYTD = iso(yearStart);

  for (const r of rows) {
    distance_m += Number(r.distance_m ?? 0);
    duration_s += Number(r.moving_time_s ?? 0);
    if (r.start_date >= since7) distance_7d_m += Number(r.distance_m ?? 0);
    if (r.start_date >= since28) {
      distance_28d_m += Number(r.distance_m ?? 0);
      elev_28 += Number(r.total_elevation_gain_m ?? 0);
      if (r.average_speed_ms) {
        speed_sum_28 += Number(r.average_speed_ms);
        speed_n_28++;
      }
      if (r.average_heartrate) {
        hr_sum_28 += Number(r.average_heartrate);
        hr_n_28++;
      }
    }
    if (r.start_date >= sinceYTD) distance_ytd_m += Number(r.distance_m ?? 0);
  }

  return {
    count,
    distance_m,
    duration_s,
    distance_7d_m,
    distance_28d_m,
    distance_ytd_m,
    avg_pace_28d_ms: speed_n_28 > 0 ? speed_sum_28 / speed_n_28 : 0,
    avg_hr_28d: hr_n_28 > 0 ? Math.round(hr_sum_28 / hr_n_28) : 0,
    elev_28d_m: elev_28,
  };
}

// =========================================================================
// Training plan
// =========================================================================

export async function getActivePlan(): Promise<TrainingPlan | null> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("training_plans")
    .select("*")
    .eq("active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as TrainingPlan) ?? null;
}

export async function getPlanMeta(): Promise<{
  total_weeks: number;
  current_week_index: number;
  total_miles_planned_m: number;
  total_miles_actual_m: number;
  adherence_pct: number;
}> {
  const plan = await getActivePlan();
  if (!plan) {
    return { total_weeks: 0, current_week_index: 0, total_miles_planned_m: 0, total_miles_actual_m: 0, adherence_pct: 0 };
  }
  const sb = createServerSupabase();
  const { data: planned, error: plannedErr } = await sb
    .from("planned_runs")
    .select("scheduled_date, target_distance_m, completion_status, completed_activity_id")
    .eq("plan_id", plan.id);
  if (plannedErr) throw plannedErr;

  const completedIds = (planned ?? [])
    .map((p) => p.completed_activity_id)
    .filter((x): x is number => x != null);
  let actualTotal = 0;
  if (completedIds.length > 0) {
    const { data: acts } = await sb
      .from("activities")
      .select("distance_m")
      .in("id", completedIds);
    actualTotal = (acts ?? []).reduce((acc, a) => acc + Number(a.distance_m ?? 0), 0);
  }
  const plannedTotal = (planned ?? []).reduce((acc, p) => acc + Number(p.target_distance_m ?? 0), 0);

  const totalWeeks = Math.max(1, Math.ceil(dayDiff(plan.start_date, plan.end_date) / 7));
  const today = todayLocalISO();
  const weeksElapsed = Math.floor(dayDiff(plan.start_date, today) / 7);
  const currentWeekIndex = Math.max(0, Math.min(totalWeeks - 1, weeksElapsed));

  const completedCount = (planned ?? []).filter((p) => p.completion_status === "completed").length;
  const dueCount = (planned ?? []).filter((p) => p.scheduled_date <= today).length;
  const adherence = dueCount > 0 ? Math.round((completedCount / dueCount) * 100) : 0;

  return {
    total_weeks: totalWeeks,
    current_week_index: currentWeekIndex,
    total_miles_planned_m: plannedTotal,
    total_miles_actual_m: actualTotal,
    adherence_pct: adherence,
  };
}

export async function getWeekMileage(): Promise<WeekMileage[]> {
  const plan = await getActivePlan();
  if (!plan) return [];
  const sb = createServerSupabase();
  const { data: planned, error } = await sb
    .from("planned_runs")
    .select("scheduled_date, target_distance_m, completed_activity_id")
    .eq("plan_id", plan.id)
    .order("scheduled_date", { ascending: true });
  if (error) throw error;

  const completedIds = (planned ?? [])
    .map((p) => p.completed_activity_id)
    .filter((x): x is number => x != null);
  const actualsById = new Map<number, number>();
  if (completedIds.length > 0) {
    const { data: acts } = await sb
      .from("activities")
      .select("id, distance_m")
      .in("id", completedIds);
    for (const a of acts ?? []) actualsById.set(Number(a.id), Number(a.distance_m ?? 0));
  }

  const buckets = new Map<number, WeekMileage>();
  for (const p of planned ?? []) {
    const week = Math.floor(dayDiff(plan.start_date, p.scheduled_date) / 7);
    const wkStartISO = addDaysISO(plan.start_date, week * 7);
    const existing = buckets.get(week) ?? {
      week_number: week + 1,
      label: `W${week + 1}`,
      start_date: wkStartISO,
      planned_m: 0,
      actual_m: 0,
    };
    existing.planned_m += Number(p.target_distance_m ?? 0);
    if (p.completed_activity_id != null) {
      existing.actual_m = (existing.actual_m ?? 0) + (actualsById.get(p.completed_activity_id) ?? 0);
    }
    buckets.set(week, existing);
  }
  const today = todayLocalISO();
  return Array.from(buckets.values())
    .sort((a, b) => a.week_number - b.week_number)
    .map((w) => ({ ...w, actual_m: w.start_date > today ? null : w.actual_m }));
}

export async function getPlannedRunByDate(dateISO: string): Promise<PlannedRun | null> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("planned_runs")
    .select("*")
    .eq("scheduled_date", dateISO)
    .maybeSingle();
  if (error) throw error;
  return (data as PlannedRun) ?? null;
}

export async function getPlannedRunsBetween(startISO: string, endISO: string): Promise<PlannedRun[]> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("planned_runs")
    .select("*")
    .gte("scheduled_date", startISO)
    .lte("scheduled_date", endISO)
    .order("scheduled_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlannedRun[];
}

export async function getWeekView(weekStartISO: string): Promise<PlanWeekDay[]> {
  const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = todayLocalISO();

  const endISO = addDaysISO(weekStartISO, 6);
  const planned = await getPlannedRunsBetween(weekStartISO, endISO);
  const sb = createServerSupabase();
  const { data: weekActs } = await sb
    .from("activities")
    .select("*")
    .gte("start_date_local", weekStartISO)
    .lte("start_date_local", endISO + "T23:59:59");

  const result: PlanWeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDaysISO(weekStartISO, i);
    const d = new Date(iso + "T00:00:00");
    const p = planned.find((pl) => pl.scheduled_date === iso) ?? null;
    const actual =
      p?.completed_activity_id != null
        ? ((weekActs ?? []).find((a: any) => Number(a.id) === p.completed_activity_id) as Activity | undefined) ?? null
        : ((weekActs ?? []).find((a: any) => a.start_date_local?.slice(0, 10) === iso) as Activity | undefined) ?? null;

    let status: PlanWeekDay["status"] = "upcoming";
    if (p?.workout_type === "rest") status = "rest";
    else if (actual) status = "done";
    else if (iso === today) status = "today";
    else if (iso < today) status = "missed";

    result.push({
      day_short: DAYS_SHORT[i],
      date_label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      date_iso: iso,
      planned: p,
      actual,
      status,
    });
  }
  return result;
}

// =========================================================================
// Gear
// =========================================================================

function decorateGear(rows: any[]): Gear[] {
  return rows.map((g, i) => ({
    ...g,
    color: pickGearColor(i, !!g.retired),
    purpose: g.description ?? "",
    cap_m: defaultCapM(g.description ?? null),
    last_run: null,
  })) as Gear[];
}

export async function getAllGear(): Promise<Gear[]> {
  const sb = createServerSupabase();
  const { data, error } = await sb.from("gear").select("*").order("retired", { ascending: true });
  if (error) throw error;
  return decorateGear(data ?? []);
}

export async function getActiveGear(): Promise<Gear[]> {
  const sb = createServerSupabase();
  const { data, error } = await sb.from("gear").select("*").eq("retired", false);
  if (error) throw error;
  return decorateGear(data ?? []);
}

export async function getGearById(id: string): Promise<Gear | null> {
  const sb = createServerSupabase();
  const { data, error } = await sb.from("gear").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return decorateGear([data])[0];
}

// =========================================================================
// Races
// =========================================================================

function decorateRace(r: any): Race {
  return {
    ...r,
    priority: r.priority ?? null,
    confidence: null,
  };
}

export async function getAllRaces(): Promise<Race[]> {
  const sb = createServerSupabase();
  const { data, error } = await sb.from("races").select("*").order("race_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(decorateRace);
}

export async function getUpcomingRaces(): Promise<Race[]> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("races")
    .select("*")
    .eq("status", "upcoming")
    .order("race_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(decorateRace);
}

export async function getNextARace(): Promise<Race | null> {
  const upcoming = await getUpcomingRaces();
  return upcoming[0] ?? null;
}

// =========================================================================
// AI analyses
// =========================================================================

export async function getAnalysisForActivity(activityId: number): Promise<RunAnalysis | null> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("run_analyses")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();
  if (error) throw error;
  return (data as RunAnalysis) ?? null;
}

// =========================================================================
// Streams + splits + route (for activity detail)
// =========================================================================

function downsample<T>(arr: T[], target: number): T[] {
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: T[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function computeSplits(distance: number[], time: number[], hr: number[], altitude: number[]) {
  const splits: { mi: number; pace: string; hr: number; elev_ft: number; partial?: boolean }[] = [];
  if (!distance || distance.length === 0) return splits;
  const totalMi = distance[distance.length - 1] / M_PER_MILE;
  let lastIdx = 0;
  for (let m = 1; m <= Math.floor(totalMi); m++) {
    const targetM = m * M_PER_MILE;
    let i = lastIdx;
    while (i < distance.length && distance[i] < targetM) i++;
    const segTime = time[i] - time[lastIdx];
    const segHr = hr.length ? Math.round(avg(hr.slice(lastIdx, i))) : 0;
    const segElev = altitude.length ? (altitude[i] - altitude[lastIdx]) / M_PER_FT : 0;
    splits.push({
      mi: m,
      pace: secsToPace(segTime),
      hr: segHr,
      elev_ft: Math.round(segElev),
    });
    lastIdx = i;
  }
  if (lastIdx < distance.length - 1) {
    const segTime = time[time.length - 1] - time[lastIdx];
    const finalMi = distance[distance.length - 1] / M_PER_MILE;
    splits.push({
      mi: Math.round(finalMi * 10) / 10,
      pace: secsToPace((segTime / (finalMi - Math.floor(totalMi))) || 0),
      hr: hr.length ? Math.round(avg(hr.slice(lastIdx))) : 0,
      elev_ft: altitude.length ? Math.round((altitude[altitude.length - 1] - altitude[lastIdx]) / M_PER_FT) : 0,
      partial: true,
    });
  }
  return splits;
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function secsToPace(s: number): string {
  if (!isFinite(s) || s <= 0) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.round(s - m * 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export async function getActivityDetail(activityId: number): Promise<{
  activity: Activity;
  hr_curve: number[];
  pace_curve: number[];
  splits: { mi: number; pace: string; hr: number; elev_ft: number; partial?: boolean }[];
  route_points: [number, number][];
  zones: HRZone[];
} | null> {
  const activity = await getActivityById(activityId);
  if (!activity) return null;
  const sb = createServerSupabase();
  const { data: streamRow } = await sb
    .from("activity_streams")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();

  const streams = (streamRow ?? {}) as Partial<ActivityStreams>;
  const hr = (streams.heartrate_data as number[] | null) ?? [];
  const time = (streams.time_data as number[] | null) ?? [];
  const distance = (streams.distance_data as number[] | null) ?? [];
  const velocity = (streams.velocity_smooth_data as number[] | null) ?? [];
  const altitude = (streams.altitude_data as number[] | null) ?? [];
  const latlng = (streams.latlng_data as [number, number][] | null) ?? [];

  const hr_curve = hr.length ? downsample(hr, 60) : [];
  const pace_curve = velocity.length
    ? downsample(velocity, 60).map((v) => (v > 0 ? M_PER_MILE / v / 60 : 0))
    : [];
  const splits = distance.length && time.length ? computeSplits(distance, time, hr, altitude) : [];

  let route_points: [number, number][] = [];
  // Detail map renders at 800x300 (aspect 800/300). Pass that so the route
  // keeps its true proportions inside the box (no horizontal stretching).
  const detailAspect = 800 / 300;
  if (latlng.length) {
    const sample = downsample(latlng, 200);
    route_points = normalizePoints(sample, { aspect: detailAspect });
  } else if (activity.summary_polyline) {
    const decoded = decodePolyline(activity.summary_polyline);
    if (decoded.length > 1) {
      route_points = normalizePoints(downsample(decoded, 200), { aspect: detailAspect });
    }
  }

  return {
    activity,
    hr_curve,
    pace_curve,
    splits,
    route_points,
    zones: defaultHRZones(),
  };
}

// =========================================================================
// HR zones + load
// =========================================================================

function defaultHRZones(): HRZone[] {
  return [
    { zone: "Z1", label: "Recover", bpm_range: "< 130", minutes: 0, pct: 0 },
    { zone: "Z2", label: "Aerobic", bpm_range: "130–148", minutes: 0, pct: 0 },
    { zone: "Z3", label: "Tempo", bpm_range: "149–162", minutes: 0, pct: 0 },
    { zone: "Z4", label: "Thresh", bpm_range: "163–175", minutes: 0, pct: 0 },
    { zone: "Z5", label: "VO₂", bpm_range: "176+", minutes: 0, pct: 0 },
  ];
}

export async function getWeekHRZones(): Promise<HRZone[]> {
  const sb = createServerSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  const { data: acts } = await sb
    .from("activities")
    .select("id, moving_time_s, average_heartrate")
    .gte("start_date", since.toISOString());
  const zones = defaultHRZones();
  if (!acts || acts.length === 0) return zones;

  const minutesBy: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
  for (const a of acts) {
    const hr = Number(a.average_heartrate ?? 0);
    const min = Number(a.moving_time_s ?? 0) / 60;
    if (!hr || !min) continue;
    const key = hr < 130 ? "Z1" : hr < 149 ? "Z2" : hr < 163 ? "Z3" : hr < 176 ? "Z4" : "Z5";
    minutesBy[key] += min;
  }
  const total = Object.values(minutesBy).reduce((a, b) => a + b, 0) || 1;
  return zones.map((z) => ({
    ...z,
    minutes: Math.round(minutesBy[z.zone]),
    pct: Math.round((minutesBy[z.zone] / total) * 100),
  }));
}

export async function getDailyLoad28d(): Promise<number[]> {
  const sb = createServerSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 28);
  const { data: acts } = await sb
    .from("activities")
    .select("start_date_local, suffer_score, moving_time_s")
    .gte("start_date", since.toISOString());
  const out = new Array(28).fill(0);
  const today = new Date();
  for (const a of acts ?? []) {
    if (!a.start_date_local) continue;
    const d = new Date(a.start_date_local);
    const dayDiff = Math.floor((today.getTime() - d.getTime()) / 86400_000);
    const idx = 27 - dayDiff;
    if (idx < 0 || idx > 27) continue;
    const load = Number(a.suffer_score ?? Math.round(Number(a.moving_time_s ?? 0) / 60));
    out[idx] += load;
  }
  return out;
}

// =========================================================================
// Long-term stats
// =========================================================================

export async function getMonthlyStats() {
  const sb = createServerSupabase();
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 5);
  since.setUTCDate(1);
  const { data: acts } = await sb
    .from("activities")
    .select("start_date_local, distance_m")
    .gte("start_date", since.toISOString());
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const buckets = new Map<string, { miles: number; runs: number; sortKey: string }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { miles: 0, runs: 0, sortKey: key });
  }
  for (const a of acts ?? []) {
    if (!a.start_date_local) continue;
    const d = new Date(a.start_date_local);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (!b) continue;
    b.miles += Number(a.distance_m ?? 0) / M_PER_MILE;
    b.runs += 1;
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({
      label: MONTHS[Number(k.slice(5)) - 1],
      miles: Math.round(v.miles),
      runs: v.runs,
    }));
}

export async function getPaceTrend12w(): Promise<number[]> {
  const sb = createServerSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 12 * 7);
  const { data: acts } = await sb
    .from("activities")
    .select("start_date, distance_m, moving_time_s")
    .gte("start_date", since.toISOString());
  const buckets: { dist: number; time: number }[] = Array.from({ length: 12 }, () => ({ dist: 0, time: 0 }));
  const today = new Date();
  for (const a of acts ?? []) {
    const d = new Date(a.start_date);
    const wkAgo = Math.floor((today.getTime() - d.getTime()) / (7 * 86400_000));
    const idx = 11 - wkAgo;
    if (idx < 0 || idx > 11) continue;
    buckets[idx].dist += Number(a.distance_m ?? 0);
    buckets[idx].time += Number(a.moving_time_s ?? 0);
  }
  return buckets.map((b) => (b.dist > 0 ? b.time / 60 / (b.dist / M_PER_MILE) : 0));
}

export async function getRestingHR12w(): Promise<number[]> {
  return [];
}

// =========================================================================
// Dashboard helpers
// =========================================================================

export async function getWeekStats(weekStartISO: string): Promise<{
  distance_m: number;
  duration_s: number;
  elev_m: number;
  avg_hr: number;
  runs: number;
}> {
  const sb = createServerSupabase();
  const start = new Date(weekStartISO + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const { data } = await sb
    .from("activities")
    .select("distance_m, moving_time_s, total_elevation_gain_m, average_heartrate")
    .gte("start_date_local", start.toISOString())
    .lt("start_date_local", end.toISOString());
  let distance_m = 0;
  let duration_s = 0;
  let elev_m = 0;
  let hrSum = 0;
  let hrN = 0;
  for (const a of data ?? []) {
    distance_m += Number(a.distance_m ?? 0);
    duration_s += Number(a.moving_time_s ?? 0);
    elev_m += Number(a.total_elevation_gain_m ?? 0);
    if (a.average_heartrate) {
      hrSum += Number(a.average_heartrate);
      hrN++;
    }
  }
  return { distance_m, duration_s, elev_m, avg_hr: hrN > 0 ? Math.round(hrSum / hrN) : 0, runs: data?.length ?? 0 };
}

export async function getStreakDays(): Promise<number> {
  const sb = createServerSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 60);
  const { data } = await sb
    .from("activities")
    .select("start_date_local")
    .gte("start_date", since.toISOString())
    .order("start_date_local", { ascending: false });
  const days = new Set<string>();
  for (const a of data ?? []) {
    if (a.start_date_local) days.add(a.start_date_local.slice(0, 10));
  }
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 60; i++) {
    const iso = cur.toISOString().slice(0, 10);
    if (days.has(iso)) streak++;
    else if (i > 0) break;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return streak;
}

export async function getShellSummary(): Promise<{
  activities: number;
  gear: number;
  races: number;
  plan: { name: string; week: number; totalWeeks: number; pct: number } | null;
  nextRace: { name: string; date: string; weeksOut: number } | null;
  lastSync: string | null;
  lastSyncCount: number;
}> {
  const sb = createServerSupabase();
  const [actCountRes, gearCountRes, raceCountRes, plan, planMeta, nextRace, lastSyncRes] = await Promise.all([
    sb.from("activities").select("id", { count: "exact", head: true }),
    sb.from("gear").select("id", { count: "exact", head: true }),
    sb.from("races").select("id", { count: "exact", head: true }).eq("status", "upcoming"),
    getActivePlan(),
    getPlanMeta(),
    getNextARace(),
    sb.from("activities").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const lastSync = (lastSyncRes.data as { synced_at: string } | null)?.synced_at ?? null;
  let lastSyncCount = 0;
  if (lastSync) {
    const since = new Date(new Date(lastSync).getTime() - 60_000).toISOString();
    const { count } = await sb
      .from("activities")
      .select("id", { count: "exact", head: true })
      .gte("synced_at", since);
    lastSyncCount = count ?? 0;
  }
  let nextRaceOut: { name: string; date: string; weeksOut: number } | null = null;
  if (nextRace) {
    const weeksOut = Math.max(
      0,
      Math.round((new Date(nextRace.race_date).getTime() - Date.now()) / (7 * 86400_000))
    );
    nextRaceOut = { name: nextRace.name, date: nextRace.race_date, weeksOut };
  }
  return {
    activities: actCountRes.count ?? 0,
    gear: gearCountRes.count ?? 0,
    races: raceCountRes.count ?? 0,
    plan: plan
      ? {
          name: plan.name,
          week: planMeta.current_week_index + 1,
          totalWeeks: planMeta.total_weeks,
          pct: planMeta.total_weeks > 0 ? Math.round(((planMeta.current_week_index + 1) / planMeta.total_weeks) * 100) : 0,
        }
      : null,
    nextRace: nextRaceOut,
    lastSync,
    lastSyncCount,
  };
}

export async function getPlanAdherenceBreakdown(): Promise<{
  sessions: { done: number; due: number };
  volume: { actual_m: number; planned_m: number };
  workouts: { done: number; due: number };
}> {
  const plan = await getActivePlan();
  if (!plan) {
    return { sessions: { done: 0, due: 0 }, volume: { actual_m: 0, planned_m: 0 }, workouts: { done: 0, due: 0 } };
  }
  const sb = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data: planned } = await sb
    .from("planned_runs")
    .select("scheduled_date, workout_type, target_distance_m, completion_status, completed_activity_id")
    .eq("plan_id", plan.id)
    .lte("scheduled_date", today);

  let sessionsDone = 0;
  let sessionsDue = 0;
  let workoutsDone = 0;
  let workoutsDue = 0;
  let plannedM = 0;
  const completedIds: number[] = [];
  for (const p of planned ?? []) {
    if (p.workout_type === "rest") continue;
    sessionsDue++;
    plannedM += Number(p.target_distance_m ?? 0);
    if (p.completion_status === "completed") sessionsDone++;
    if (p.completed_activity_id != null) completedIds.push(Number(p.completed_activity_id));
    if (p.workout_type === "interval" || p.workout_type === "tempo" || p.workout_type === "workout") {
      workoutsDue++;
      if (p.completion_status === "completed") workoutsDone++;
    }
  }
  let actualM = 0;
  if (completedIds.length) {
    const { data: acts } = await sb.from("activities").select("distance_m").in("id", completedIds);
    actualM = (acts ?? []).reduce((a, b) => a + Number(b.distance_m ?? 0), 0);
  }
  return {
    sessions: { done: sessionsDone, due: sessionsDue },
    volume: { actual_m: actualM, planned_m: plannedM },
    workouts: { done: workoutsDone, due: workoutsDue },
  };
}
