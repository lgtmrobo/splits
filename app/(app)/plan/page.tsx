import { BurndownChart } from "@/components/charts/burndown-chart";
import { Icon } from "@/components/ui/icon";
import { PlanViewSwitcher } from "@/app/(app)/plan/view-switcher";
import { CardHeader, Pill } from "@/components/ui/primitives";
import {
  getActivePlan,
  getPlanMeta,
  getPlannedRunsBetween,
  getWeekMileage,
  getWeekView,
} from "@/lib/supabase/queries";
import { metersToMiles } from "@/lib/utils/units";
import { addDaysISO, sundayOfISO, todayLocalISO } from "@/lib/utils/dates";
import type { PlannedRun, PlanWeekDay } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtMd(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function fmtRange(startISO: string): string {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()} – ${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;
}
const addDays = addDaysISO;

export default async function PlanPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const view = (searchParams.view as "week" | "block" | "full" | undefined) ?? "week";
  const plan = await getActivePlan();
  if (!plan) {
    return (
      <div className="content fadein">
        <div className="muted" style={{ padding: 40, textAlign: "center" }}>
          No active training plan.
        </div>
      </div>
    );
  }

  const meta = await getPlanMeta();
  const weekMileage = await getWeekMileage();

  const todayISO = todayLocalISO();
  const thisWeekStart = sundayOfISO(todayISO);
  const nextWeekStart = addDays(thisWeekStart, 7);

  const [weekView, nextWeekRuns] = await Promise.all([
    getWeekView(thisWeekStart),
    getPlannedRunsBetween(nextWeekStart, addDays(nextWeekStart, 6)),
  ]);

  const totalActualMi = metersToMiles(meta.total_miles_actual_m);
  const totalPlannedMi = metersToMiles(meta.total_miles_planned_m);
  const deficitMi = totalPlannedMi - totalActualMi;

  const peakWeek = weekMileage.reduce<{ label: string; miles: number; start_date: string } | null>(
    (best, w) => {
      const mi = metersToMiles(w.planned_m);
      if (!best || mi > best.miles) return { label: w.label, miles: mi, start_date: w.start_date };
      return best;
    },
    null
  );

  const weeksRemaining = Math.max(0, meta.total_weeks - meta.current_week_index - 1);
  const upcomingPlanned = await getPlannedRunsBetween(todayISO, plan.end_date);
  const workoutsRemaining = upcomingPlanned.filter(
    (p) => p.workout_type === "interval" || p.workout_type === "tempo" || p.workout_type === "workout"
  ).length;
  const longRunsRemaining = upcomingPlanned.filter((p) => p.workout_type === "long").length;
  const longestUpcoming = upcomingPlanned.reduce<PlannedRun | null>(
    (best, p) =>
      !best || (Number(p.target_distance_m ?? 0) > Number(best.target_distance_m ?? 0)) ? p : best,
    null
  );
  const longestUpcomingWeek = longestUpcoming
    ? weekMileage.find((w) => w.start_date <= longestUpcoming.scheduled_date && longestUpcoming.scheduled_date <= addDays(w.start_date, 6))
    : null;

  // Taper = first week below the peak after the peak, or last 2 weeks of plan.
  let taperStart: { label: string; date: string } | null = null;
  if (peakWeek) {
    const peakIdx = weekMileage.findIndex((w) => w.start_date === peakWeek.start_date);
    for (let i = peakIdx + 1; i < weekMileage.length; i++) {
      if (metersToMiles(weekMileage[i].planned_m) < peakWeek.miles * 0.75) {
        taperStart = { label: weekMileage[i].label, date: weekMileage[i].start_date };
        break;
      }
    }
  }

  const nextFour = upcomingPlanned
    .filter((p) => p.workout_type !== "rest")
    .slice(0, 4);

  const thisWeekPlannedMi = weekView.reduce(
    (acc, d) => acc + (d.planned ? metersToMiles(d.planned.target_distance_m ?? 0) : 0),
    0
  );
  const thisWeekActualMi = weekView.reduce(
    (acc, d) => acc + (d.actual ? metersToMiles(d.actual.distance_m) : 0),
    0
  );
  const thisWeekDone = weekView.filter((d) => d.actual).length;
  const thisWeekHas = weekView.filter((d) => d.planned && d.planned.workout_type !== "rest").length;

  const nextWeekTotalMi = nextWeekRuns.reduce((a, p) => a + metersToMiles(p.target_distance_m ?? 0), 0);

  const onPaceFinishMi = totalActualMi + (totalPlannedMi - totalActualMi) * (meta.adherence_pct / 100);

  return (
    <div className="content fadein">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="col gap-4">
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>
            {plan.name}
          </h1>
          <div className="muted num" style={{ fontSize: 12 }}>
            {fmtMd(plan.start_date)} → {fmtMd(plan.end_date)} · {meta.total_weeks} weeks · Week{" "}
            <span style={{ color: "var(--accent)" }}>{meta.current_week_index + 1}</span> of{" "}
            {meta.total_weeks} · {meta.adherence_pct}% adherence
          </div>
        </div>
        <div className="row gap-10">
          <PlanViewSwitcher />
          <button type="button" className="btn">Export</button>
          <button type="button" className="btn primary">Edit plan</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="col gap-4">
            <div className="stat-label" style={{ marginBottom: 0 }}>Cumulative Mileage · Plan vs Actual</div>
            <div className="row gap-14 baseline" style={{ marginTop: 6 }}>
              <div className="row baseline gap-4">
                <span className="stat-num lg">{totalActualMi.toFixed(1)}</span>
                <span className="stat-unit">mi logged</span>
              </div>
              <span className="muted num" style={{ fontSize: 12 }}>
                of {totalPlannedMi.toFixed(0)} planned
              </span>
              {deficitMi > 0 && <Pill kind="warn">−{deficitMi.toFixed(1)} mi vs plan</Pill>}
              {deficitMi <= 0 && totalActualMi > 0 && (
                <Pill kind="accent">on pace · {Math.round(onPaceFinishMi)}mi at finish</Pill>
              )}
            </div>
          </div>
          <div className="row gap-14" style={{ flexShrink: 0 }}>
            {peakWeek && (
              <div className="col" style={{ alignItems: "flex-end", whiteSpace: "nowrap" }}>
                <span className="stat-label" style={{ marginBottom: 0 }}>Peak week</span>
                <span className="num" style={{ fontSize: 16 }}>{peakWeek.miles.toFixed(0)} mi · {peakWeek.label}</span>
              </div>
            )}
            <div className="vr" />
            {taperStart ? (
              <div className="col" style={{ alignItems: "flex-end", whiteSpace: "nowrap" }}>
                <span className="stat-label" style={{ marginBottom: 0 }}>Taper starts</span>
                <span className="num" style={{ fontSize: 16 }}>{taperStart.label} · {fmtMd(taperStart.date)}</span>
              </div>
            ) : (
              <div className="col" style={{ alignItems: "flex-end", whiteSpace: "nowrap" }}>
                <span className="stat-label" style={{ marginBottom: 0 }}>Plan ends</span>
                <span className="num" style={{ fontSize: 16 }}>{fmtMd(plan.end_date)}</span>
              </div>
            )}
          </div>
        </div>
        <BurndownChart
          weeks={weekMileage}
          currentWeek={meta.current_week_index}
          width={1280}
          height={260}
        />
      </div>

      {view === "block" && (
        <div className="card" style={{ marginBottom: 14 }}>
          <CardHeader title="All Weeks · Block view" action={`${weekMileage.length} weeks`} />
          <div className="col gap-6">
            {weekMileage.map((w) => {
              const planned = metersToMiles(w.planned_m);
              const actual = w.actual_m != null ? metersToMiles(w.actual_m) : null;
              const isCurrent = w.week_number - 1 === meta.current_week_index;
              const isPast = w.start_date < todayISO && !isCurrent;
              return (
                <div
                  key={w.start_date}
                  className="row between gap-10"
                  style={{
                    padding: "10px 12px",
                    background: isCurrent ? "var(--accent-soft)" : "var(--surface-2)",
                    border: `1px solid ${isCurrent ? "var(--accent)" : "var(--hairline)"}`,
                    borderRadius: 8,
                    fontFamily: "var(--font-geist-mono), monospace",
                    fontSize: 12,
                  }}
                >
                  <span style={{ width: 56, color: "var(--text-3)" }}>{w.label}</span>
                  <span style={{ width: 110, color: "var(--text-2)" }}>{fmtRange(w.start_date)}</span>
                  <span className="num" style={{ flex: 1, textAlign: "right", color: "var(--text-1)" }}>
                    {actual != null ? actual.toFixed(1) : "—"} <span className="muted">/ {planned.toFixed(0)} mi</span>
                  </span>
                  {isCurrent && <Pill kind="accent">Now</Pill>}
                  {isPast && actual != null && actual >= planned * 0.95 && <Pill kind="accent">✓</Pill>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "full" && (
        <div className="col gap-14" style={{ marginBottom: 14 }}>
          {weekMileage.map(async (w) => {
            const days = await getWeekView(w.start_date);
            const isCurrent = w.week_number - 1 === meta.current_week_index;
            return (
              <div key={w.start_date} className="card">
                <CardHeader
                  title={`${w.label} · ${fmtRange(w.start_date)}`}
                  action={`${metersToMiles(w.planned_m).toFixed(0)} mi planned${isCurrent ? " · current" : ""}`}
                />
                <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                  {days.map((d) => <WeekDayCell key={d.date_iso} day={d} todayISO={todayISO} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "week" && (
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 14 }}>
        <div className="card">
          <CardHeader
            title={`This Week · ${fmtRange(thisWeekStart)}`}
            action={`${thisWeekActualMi.toFixed(1)} / ${thisWeekPlannedMi.toFixed(0)} mi · ${thisWeekDone}/${thisWeekHas} done`}
          />
          <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {weekView.map((d) => <WeekDayCell key={d.date_iso} day={d} todayISO={todayISO} />)}
          </div>
        </div>

        <div className="card">
          <CardHeader title="Block Summary" />
          <div className="col gap-14">
            <div className="col gap-6">
              <div className="row between">
                <span className="stat-label" style={{ marginBottom: 0 }}>Weeks remaining</span>
                <span className="num">{weeksRemaining}</span>
              </div>
              <div className="row between">
                <span className="stat-label" style={{ marginBottom: 0 }}>Workouts remaining</span>
                <span className="num">{workoutsRemaining}</span>
              </div>
              <div className="row between">
                <span className="stat-label" style={{ marginBottom: 0 }}>Long runs remaining</span>
                <span className="num">{longRunsRemaining}</span>
              </div>
              {longestUpcoming && (
                <div className="row between">
                  <span className="stat-label" style={{ marginBottom: 0 }}>Longest upcoming</span>
                  <span className="num">
                    {metersToMiles(longestUpcoming.target_distance_m ?? 0).toFixed(0)} mi
                    {longestUpcomingWeek ? ` · ${longestUpcomingWeek.label}` : ""}
                  </span>
                </div>
              )}
            </div>
            {nextFour.length > 0 && (
              <>
                <div className="hr" />
                <div className="col gap-6">
                  <div className="stat-label" style={{ marginBottom: 0 }}>Next workouts</div>
                  {nextFour.map((p) => (
                    <div key={p.id} className="row between gap-8" style={{ fontSize: 12 }}>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {fmtMd(p.scheduled_date)} · {p.description ?? p.workout_type}
                      </span>
                      <span className="num muted" style={{ flexShrink: 0 }}>
                        {metersToMiles(p.target_distance_m ?? 0).toFixed(1)} mi
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {view === "week" && nextWeekRuns.length > 0 && (
        <div className="card">
          <CardHeader
            title={`Next Week · ${fmtRange(nextWeekStart)}`}
            action={`${nextWeekTotalMi.toFixed(0)} mi planned`}
          />
          <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const date = addDays(nextWeekStart, i);
              const p = nextWeekRuns.find((r) => r.scheduled_date === date);
              const label = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                new Date(date + "T00:00:00").getDay()
              ];
              const wt = p?.workout_type ?? "rest";
              const miles = p?.target_distance_m ? metersToMiles(p.target_distance_m) : 0;
              return (
                <div
                  key={date}
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 110,
                    opacity: !p || wt === "rest" ? 0.55 : 1,
                  }}
                >
                  <div className="row between" style={{ alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {label}
                    </span>
                    <span className="num" style={{ fontSize: 11, color: "var(--text-3)" }}>{date.slice(-2)}</span>
                  </div>
                  <Pill kind={wt === "workout" || wt === "interval" ? "accent" : wt === "race" ? "warn" : "muted"}>
                    {wt.charAt(0).toUpperCase() + wt.slice(1)}
                  </Pill>
                  <div className="num" style={{ fontSize: 16, marginTop: 8, color: "var(--text-1)" }}>
                    {miles > 0 ? `${miles.toFixed(1)}mi` : "—"}
                  </div>
                  {p?.description && (
                    <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4, lineHeight: 1.35 }}>
                      {p.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WeekDayCell({ day, todayISO }: { day: PlanWeekDay; todayISO: string }) {
  const isToday = day.date_iso === todayISO;
  const isDone = day.status === "done";
  const isRest = day.status === "rest";
  const planned = day.planned;
  const wt = planned?.workout_type ?? "rest";
  const miles = planned?.target_distance_m ? metersToMiles(planned.target_distance_m) : 0;
  // Travel/event tag lifted out of description ("X · Vegas" or just "Vegas"
  // on a rest day). Keeps the detection narrow so normal descriptions like
  // "Rest" or "3 mi easy" aren't mis-tagged.
  const desc = planned?.description?.trim() ?? "";
  const sufMatch = desc.match(/·\s*([A-Z][A-Za-z ]+)$/);
  const travelTag: string | null = sufMatch
    ? sufMatch[1].trim()
    : planned?.workout_type === "rest" && desc && desc !== "Rest"
    ? desc
    : null;

  return (
    <div
      style={{
        background: isToday ? "var(--accent-soft)" : "var(--surface-2)",
        border: `1px solid ${isToday ? "var(--accent)" : "var(--hairline)"}`,
        borderRadius: 10,
        padding: 12,
        minHeight: 160,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: isRest && !travelTag ? 0.6 : 1,
      }}
    >
      <div className="row between" style={{ alignItems: "baseline" }}>
        <div className="col">
          <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: isToday ? "var(--accent)" : "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {day.day_short}
          </span>
          <span className="num" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {day.date_label.split(" ")[1]}
          </span>
        </div>
        {isDone && <Icon name="check" size={14} />}
        {isToday && <span className="pill accent" style={{ padding: "2px 6px" }}>Today</span>}
        {!isToday && travelTag && (
          <span
            className="pill"
            style={{
              padding: "2px 6px",
              background: "var(--surface-3)",
              color: "var(--text-2)",
              fontSize: 10,
              letterSpacing: "0.04em",
            }}
          >
            ✈ {travelTag}
          </span>
        )}
      </div>
      <div className="col gap-4">
        <Pill kind={wt === "workout" || wt === "interval" ? "accent" : wt === "rest" ? "muted" : "default"}>
          {wt.charAt(0).toUpperCase() + wt.slice(1)}
        </Pill>
        <div className="num" style={{ fontSize: 18, fontWeight: 500, color: "var(--text-1)" }}>
          {miles > 0 ? `${miles.toFixed(0)}mi` : "—"}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.35 }}>
        {planned?.description}
      </div>
      {isDone && day.actual && (
        <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--hairline)" }}>
          <div className="row between" style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>Logged</span>
            <span style={{ color: "var(--accent)" }}>✓</span>
          </div>
          <div className="row between" style={{ marginTop: 4, fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, color: "var(--text-1)" }}>
            <span>{metersToMiles(day.actual.distance_m).toFixed(1)}mi</span>
            <span>
              {day.actual.average_speed_ms
                ? (() => {
                    const secPerMile = 1609.344 / day.actual.average_speed_ms;
                    const m = Math.floor(secPerMile / 60);
                    const s = Math.round(secPerMile % 60);
                    return `${m}:${String(s).padStart(2, "0")}`;
                  })()
                : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
