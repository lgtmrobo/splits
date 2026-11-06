import { PmcChart } from "@/components/charts/pmc-chart";
import { CardHeader, Pill, Stat } from "@/components/ui/primitives";
import { buildFitnessModel, PEAK_RECENT_DAYS, PMC_HISTORY_DAYS, type FitnessModel } from "@/lib/fitness/model";
import { formZone, type FormZoneKey } from "@/lib/fitness/pmc";
import type { FitnessInputs } from "@/lib/fitness/types";
import { getFitnessInputs } from "@/lib/supabase/queries";
import { dayDiff } from "@/lib/utils/dates";
import { secPerKmToPacePerMile, speedToPacePerMile } from "@/lib/utils/units";
import { PeaksTable } from "./peaks-table";
import { ThresholdsForm, type ThresholdField } from "./thresholds-form";
import { TrailCard } from "./trail-card";

/** TrainingPeaks' rule of thumb: more than ~8 CTL/week is a risky build. */
const RAMP_WARN = 8;

const ZONE_PILL: Record<FormZoneKey, "accent" | "warn" | "red" | "muted" | "default"> = {
  transition: "default",
  fresh: "accent",
  neutral: "muted",
  optimal: "warn",
  risk: "red",
};

function signed(n: number): string {
  const r = Math.round(n);
  return `${r > 0 ? "+" : ""}${r}`;
}

function thresholdFields(model: FitnessModel, overrides: FitnessInputs["overrides"]): ThresholdField[] {
  const t = model.thresholds;
  const s = model.thresholdSources;
  return [
    {
      name: "pace",
      label: "Threshold pace",
      setValue: overrides?.threshold_pace_s_per_km ? secPerKmToPacePerMile(overrides.threshold_pace_s_per_km) : "",
      current: speedToPacePerMile(t.thresholdSpeedMs),
      source: s.thresholdSpeedMs,
      unit: "/mi",
    },
    { name: "lthr", label: "Threshold HR", setValue: overrides?.lthr ? String(overrides.lthr) : "", current: t.lthr ? String(t.lthr) : "—", source: s.lthr, unit: "bpm" },
    { name: "resting_hr", label: "Resting HR", setValue: overrides?.resting_hr ? String(overrides.resting_hr) : "", current: t.restingHr ? String(t.restingHr) : "—", source: s.restingHr, unit: "bpm" },
    { name: "max_hr", label: "Max HR", setValue: overrides?.max_hr ? String(overrides.max_hr) : "", current: t.maxHr ? String(t.maxHr) : "—", source: s.maxHr, unit: "bpm" },
  ];
}

export default async function FitnessPage() {
  const inputs = await getFitnessInputs();
  const model = buildFitnessModel(inputs);
  const today = model.pmc[model.todayIndex] ?? model.pmc.at(-1);
  const zone = today ? formZone(today.tsb) : null;
  const methodCounts = [...model.tssByActivity.values()].reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.method]: (acc[r.method] ?? 0) + 1 }),
    {},
  );

  return (
    <div className="content fadein">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="col gap-4">
          <h1 className="page-title">Fitness</h1>
          <div className="muted num" style={{ fontSize: 12 }}>
            Threshold {speedToPacePerMile(model.thresholds.thresholdSpeedMs)}/mi · LTHR {model.thresholds.lthr ?? "—"} · TSS from HR on{" "}
            {methodCounts.hr ?? 0} runs, pace on {methodCounts.pace ?? 0}, duration on {methodCounts.duration ?? 0}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 14 }}>
        <div className="card compact">
          <Stat label="Fitness · CTL" value={today ? today.ctl.toFixed(0) : "—"} size="lg" delta="42-day load" />
        </div>
        <div className="card compact">
          <Stat label="Fatigue · ATL" value={today ? today.atl.toFixed(0) : "—"} size="lg" delta="7-day load" />
        </div>
        <div className="card compact">
          <Stat
            label="Form · TSB"
            value={today ? signed(today.tsb) : "—"}
            size="lg"
            delta={zone ? <><Pill kind={ZONE_PILL[zone.key]}>{zone.label}</Pill> <span className="muted">{zone.hint}</span></> : undefined}
          />
        </div>
        <div className="card compact">
          <Stat
            label="Ramp rate"
            value={model.ramp != null ? `${model.ramp >= 0 ? "+" : ""}${model.ramp.toFixed(1)}` : "—"}
            unit="CTL/wk"
            size="lg"
            delta={model.ramp != null ? (model.ramp > RAMP_WARN ? "Building fast — watch it" : "Sustainable") : undefined}
            deltaKind={model.ramp != null && model.ramp > RAMP_WARN ? "warn" : "up"}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <CardHeader title={`Performance Management · ${PMC_HISTORY_DAYS}d + plan`} action="Dashed = projected from planned runs" />
        <PmcChart
          points={model.pmc}
          todayIndex={model.todayIndex}
          races={inputs.upcomingRaces.map((r) => ({ date: r.race_date, name: r.name }))}
        />
        <div className="row gap-16 muted" style={{ fontSize: 11, marginTop: 8 }}>
          <span><span style={{ color: "var(--accent)" }}>━</span> Fitness</span>
          <span><span style={{ color: "var(--purple)" }}>━</span> Fatigue</span>
          <span><span style={{ color: "var(--blue)" }}>■</span> Very fresh</span>
          <span><span style={{ color: "var(--accent)" }}>■</span> Fresh</span>
          <span><span style={{ color: "var(--amber)" }}>■</span> Productive</span>
          <span><span style={{ color: "var(--red)" }}>■</span> Overreaching</span>
        </div>
      </div>

      {model.raceForms.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(model.raceForms.length, 3)}, 1fr)`, marginBottom: 14 }}>
          {model.raceForms.map(({ race, tsb, ctl }) => {
            const z = formZone(tsb);
            const days = dayDiff(inputs.todayISO, race.race_date);
            return (
              <div key={race.id} className="card compact">
                <CardHeader title={race.name} action={`${race.race_date} · ${days}d`} />
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Stat label="Race-morning form" value={signed(tsb)} size="lg" delta={<Pill kind={ZONE_PILL[z.key]}>{z.label}</Pill>} />
                  <Stat label="Fitness on the day" value={ctl.toFixed(0)} size="lg" delta="If the plan holds" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 14, alignItems: "start" }}>
        <PeaksTable rows={model.peaks} recentWeeks={Math.round(PEAK_RECENT_DAYS / 7)} missing={model.activitiesMissingEfforts} />
        <div className="col gap-14">
          <div className="card">
            <CardHeader title="VDOT · 180d" />
            <Stat
              label="Best race-length effort"
              value={model.vdot ? model.vdot.vdot.toFixed(1) : "—"}
              size="lg"
              delta={model.vdot ? `${model.vdot.effort.name} on ${model.vdot.effort.date}` : "Needs a 5K+ effort"}
            />
          </div>
          <div className="card">
            <CardHeader title="Thresholds" action="Drives every TSS number" />
            <ThresholdsForm fields={thresholdFields(model, inputs.overrides)} />
          </div>
        </div>
      </div>

      <TrailCard weeks={model.weeklyTrail} longest={model.longestOuting} />
    </div>
  );
}
