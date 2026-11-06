// Ties the pure fitness pieces together for the pages: thresholds → per-run
// TSS → PMC (actual + planned projection) → peaks / VDOT / trail volume.
import { bestVdot, extractEfforts, peakPerformances, type BestEffort, type PeakRow } from "@/lib/fitness/best-efforts";
import { buildPmc, rampRate, type PmcPoint } from "@/lib/fitness/pmc";
import {
  estimateThresholds,
  resolveThresholds,
  type Thresholds,
  type ThresholdSource,
} from "@/lib/fitness/thresholds";
import { weeklyTrailStats, longestTimeOnFeet, type WeeklyTrail } from "@/lib/fitness/trail";
import { activityTss, plannedRunTss, type TssResult } from "@/lib/fitness/tss";
import type { FitnessActivity, FitnessInputs } from "@/lib/fitness/types";
import { addDaysISO } from "@/lib/utils/dates";
import type { Race } from "@/lib/types";

/** How much history the PMC chart shows before today. */
export const PMC_HISTORY_DAYS = 120;
const TRAIL_WEEKS = 16;
export const PEAK_RECENT_DAYS = 84;

export interface RaceForm {
  race: Race;
  /** Form walking into race morning (TSB = yesterday's CTL − ATL). */
  tsb: number;
  ctl: number;
}

export interface FitnessModel {
  thresholds: Thresholds;
  thresholdSources: Record<keyof Thresholds, ThresholdSource>;
  tssByActivity: Map<number, TssResult>;
  pmc: PmcPoint[];
  todayIndex: number;
  ramp: number | null;
  raceForms: RaceForm[];
  peaks: PeakRow[];
  vdot: { vdot: number; effort: BestEffort } | null;
  weeklyTrail: WeeklyTrail[];
  longestOuting: FitnessActivity | null;
  effortCount: number;
  activitiesMissingEfforts: number;
}

export function buildFitnessModel(inputs: FitnessInputs): FitnessModel {
  const { activities, planned, upcomingRaces, overrides, restingHr, todayISO } = inputs;

  const efforts = activities.flatMap((a) =>
    extractEfforts({ id: a.id, start_date_local: a.start_date_local, best_efforts: a.best_efforts }),
  );
  const estimates = estimateThresholds({ activities, efforts, restingHr, todayISO });
  const { values: thresholds, sources: thresholdSources } = resolveThresholds(overrides, estimates);

  const tssByActivity = new Map<number, TssResult>();
  const daily: Record<string, number> = {};
  for (const a of activities) {
    const r = activityTss(a, thresholds);
    tssByActivity.set(a.id, r);
    const d = a.start_date_local.slice(0, 10);
    daily[d] = (daily[d] ?? 0) + r.tss;
  }
  // Planned load fills today (if not run yet) and every future day.
  const plannedDaily: Record<string, number> = {};
  for (const p of planned) {
    if (p.scheduled_date < todayISO) continue;
    if (p.scheduled_date === todayISO && daily[todayISO]) continue;
    plannedDaily[p.scheduled_date] = (plannedDaily[p.scheduled_date] ?? 0) + plannedRunTss(p, thresholds);
  }
  const combined = { ...daily, ...plannedDaily };

  const lastRace = upcomingRaces.reduce<string | null>(
    (max, r) => (!max || r.race_date > max ? r.race_date : max),
    null,
  );
  const lastPlanned = planned.at(-1)?.scheduled_date ?? null;
  const endISO = [todayISO, lastRace, lastPlanned]
    .filter((d): d is string => !!d)
    .reduce((a, b) => (b > a ? b : a));
  const startISO = addDaysISO(todayISO, -PMC_HISTORY_DAYS);
  const warmupFrom = activities[0]?.start_date_local.slice(0, 10);
  const pmc = buildPmc(combined, startISO, endISO, todayISO, warmupFrom);
  const todayIndex = pmc.findIndex((p) => p.date === todayISO);

  const raceForms = upcomingRaces
    .map((race) => {
      const pt = pmc.find((p) => p.date === race.race_date);
      return pt ? { race, tsb: pt.tsb, ctl: pt.ctl } : null;
    })
    .filter((r): r is RaceForm => r !== null);

  return {
    thresholds,
    thresholdSources,
    tssByActivity,
    pmc,
    todayIndex,
    ramp: rampRate(pmc, todayIndex),
    raceForms,
    peaks: peakPerformances(efforts, todayISO, PEAK_RECENT_DAYS),
    vdot: bestVdot(efforts, todayISO),
    weeklyTrail: weeklyTrailStats(activities, todayISO, TRAIL_WEEKS),
    longestOuting: longestTimeOnFeet(activities),
    effortCount: efforts.length,
    activitiesMissingEfforts: activities.filter((a) => a.best_efforts == null).length,
  };
}
