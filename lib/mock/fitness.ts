// Mock twin of lib/supabase/queries.fitness.ts for `pnpm dev:mock`.
// The hand-written ACTIVITIES only cover one week, so a deterministic
// 20-week history is generated behind them to give the PMC something to
// draw.
import { ACTIVITIES, PLANNED_RUNS, RACES } from "@/lib/mock/data";
import type { FitnessActivity, FitnessInputs } from "@/lib/fitness/types";

const MOCK_TODAY = "2026-04-18"; // matches lib/mock/queries.ts
const HISTORY_DAYS = 140;
const MI = 1609.344;

/** Weekly shape: [miles, sec/mi, avg HR, climb m] per weekday (Mon first). */
const WEEK: Array<[number, number, number, number] | null> = [
  [6, 540, 142, 40],
  [8, 470, 158, 30],
  null,
  [7, 530, 145, 60],
  [5, 560, 138, 20],
  [14, 545, 148, 220],
  [4, 600, 132, 15],
];

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
}

function syntheticEfforts(distanceM: number, secPerMi: number) {
  const marks: Array<[string, number]> = [
    ["400m", 400],
    ["1 mile", 1609],
    ["5K", 5000],
    ["10K", 10000],
    ["Half-Marathon", 21097],
  ];
  return marks
    .filter(([, d]) => d <= distanceM)
    .map(([name, d]) => ({
      name,
      distance: d,
      // Short segments inside a run go a touch faster than the average.
      elapsed_time: Math.round((d / MI) * secPerMi * (d < 2000 ? 0.92 : 0.97)),
      moving_time: Math.round((d / MI) * secPerMi * (d < 2000 ? 0.92 : 0.97)),
      pr_rank: null,
    }));
}

function generatedHistory(): FitnessActivity[] {
  const firstReal = ACTIVITIES.map((a) => a.start_date_local.slice(0, 10)).sort()[0];
  const out: FitnessActivity[] = [];
  for (let i = HISTORY_DAYS; i > 0; i--) {
    const date = addDays(firstReal, -i);
    const dow = (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
    const slot = WEEK[dow];
    // Every 4th week is a cutback; build slowly over the block.
    const weekIdx = Math.floor((HISTORY_DAYS - i) / 7);
    if (!slot) continue;
    const scale = (weekIdx % 4 === 3 ? 0.7 : 1) * (0.75 + weekIdx * 0.015);
    const [mi, pace, hr, climb] = slot;
    const distance = mi * MI * scale;
    const moving = Math.round((distance / MI) * (pace - weekIdx));
    out.push({
      id: 9_000_000_000 + i,
      name: dow === 5 ? "Long Run" : dow === 1 ? "Workout" : "Easy Run",
      start_date_local: `${date}T07:00:00Z`,
      sport_type: dow === 5 && weekIdx % 2 === 0 ? "TrailRun" : "Run",
      distance_m: distance,
      moving_time_s: moving,
      elapsed_time_s: moving + 120,
      total_elevation_gain_m: climb * scale * (dow === 5 && weekIdx % 2 === 0 ? 3 : 1),
      average_heartrate: hr,
      max_heartrate: hr + 18,
      best_efforts: syntheticEfforts(distance, pace - weekIdx),
    });
  }
  return out;
}

export async function getFitnessInputs(): Promise<FitnessInputs> {
  const real: FitnessActivity[] = ACTIVITIES.map((a) => ({
    id: a.id,
    name: a.name,
    start_date_local: a.start_date_local,
    sport_type: a.sport_type,
    distance_m: a.distance_m,
    moving_time_s: a.moving_time_s,
    elapsed_time_s: a.elapsed_time_s,
    total_elevation_gain_m: a.total_elevation_gain_m,
    average_heartrate: a.average_heartrate,
    max_heartrate: a.max_heartrate,
    best_efforts: syntheticEfforts(a.distance_m, a.moving_time_s / (a.distance_m / MI)),
  }));
  return {
    todayISO: MOCK_TODAY,
    activities: [...generatedHistory(), ...real].sort((a, b) =>
      a.start_date_local.localeCompare(b.start_date_local),
    ),
    planned: PLANNED_RUNS.filter((p) => p.scheduled_date >= MOCK_TODAY),
    upcomingRaces: RACES.filter((r) => r.status === "upcoming"),
    overrides: null,
    restingHr: 48,
  };
}

export async function getGradeAdjustedSpeed(activityId: number): Promise<number | null> {
  const a = ACTIVITIES.find((x) => x.id === activityId);
  if (!a?.average_speed_ms) return null;
  // Pretend the route rolls a little: GAP a few seconds/mi faster.
  return a.average_speed_ms * (1 + Number(a.total_elevation_gain_m ?? 0) / Math.max(a.distance_m, 1));
}
