import Link from "next/link";
import { LineChart } from "@/components/charts/line-chart";
import { LoadStrip } from "@/components/charts/load-strip";
import { MileageBars } from "@/components/charts/mileage-bars";
import { Ring } from "@/components/charts/ring";
import { Sparkline } from "@/components/charts/sparkline";
import { ZoneBar } from "@/components/charts/zone-bar";
import { RouteThumb } from "@/components/maps/route-thumb";
import { Icon } from "@/components/ui/icon";
import { Stat } from "@/components/ui/primitives";
import { FluidList, FluidRow } from "@/components/fluid/fluid-list";
import { TypePill } from "@/components/ui/type-pill";
import {
  getActiveGear,
  getActivePlan,
  getDailyLoad28d,
  getMonthlyStats,
  getNextARace,
  getPaceTrend12w,
  getLatestRecovery,
  getPlanAdherenceBreakdown,
  getPlanMeta,
  getPlannedRunsBetween,
  getRecentActivities,
  getStreakDays,
  getWeekHRZones,
  getWeekMileage,
  getWeekStats,
  getWeekView,
} from "@/lib/supabase/queries";
import type { WorkoutType } from "@/lib/types";
import {
  formatDurationShort,
  formatFeet,
  formatMiles,
  formatMilesHalf,
  metersToMiles,
  speedToPacePerMile,
} from "@/lib/utils/units";
import { todayLocalISO } from "@/lib/utils/dates";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const M_PER_MILE = 1609.344;

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function fmtDateRange(startISO: string): string {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()} – ${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;
}
function paceFromGoal(distance_m: number, goal_s: number | null): string {
  if (!goal_s) return "—";
  const sec = goal_s / metersToMiles(distance_m);
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function fmtGoalTime(s: number | null): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}m`;
}
function labelForActivity(
  planned: WorkoutType | undefined,
  name: string,
): string {
  if (planned === "long") return "Long";
  if (planned === "interval" || planned === "tempo" || planned === "workout")
    return "Workout";
  if (planned === "recovery") return "Recovery";
  if (planned === "race") return "Race";
  if (planned === "easy") return "Easy";
  const n = name.toLowerCase();
  if (n.includes("threshold") || n.includes("vo")) return "Workout";
  if (n.includes("long")) return "Long";
  if (n.includes("recovery")) return "Recovery";
  if (n.includes("fartlek")) return "Fartlek";
  return "Easy";
}

function daysUntil(dateISO: string): number {
  const today = todayLocalISO();
  const d = Date.UTC(
    +dateISO.slice(0, 4),
    +dateISO.slice(5, 7) - 1,
    +dateISO.slice(8, 10),
  );
  const t = Date.UTC(
    +today.slice(0, 4),
    +today.slice(5, 7) - 1,
    +today.slice(8, 10),
  );
  return Math.round((d - t) / 86400_000);
}

export default async function DashboardPage() {
  const [
    planMeta,
    plan,
    weekMileage,
    dailyLoad,
    zones,
    recent,
    gear,
    paceTrend,
    monthly,
    nextRace,
    adherence,
    streak,
    recovery,
  ] = await Promise.all([
    getPlanMeta(),
    getActivePlan(),
    getWeekMileage(),
    getDailyLoad28d(),
    getWeekHRZones(),
    getRecentActivities(5),
    getActiveGear(),
    getPaceTrend12w(),
    getMonthlyStats(),
    getNextARace(),
    getPlanAdherenceBreakdown(),
    getStreakDays(),
    getLatestRecovery(),
  ]);

  const currentWeek =
    weekMileage[planMeta.current_week_index] ??
    weekMileage[weekMileage.length - 1] ??
    null;
  const todayISO = todayLocalISO();
  const weekStartISO = currentWeek?.start_date ?? todayISO;
  const [weekStats, weekView] = await Promise.all([
    getWeekStats(weekStartISO),
    getWeekView(weekStartISO),
  ]);

  const thisWeekMi = metersToMiles(weekStats.distance_m);
  const thisWeekTargetMi = currentWeek
    ? metersToMiles(currentWeek.planned_m)
    : 0;
  const thisWeekProgressPct =
    thisWeekTargetMi > 0
      ? Math.round((thisWeekMi / thisWeekTargetMi) * 100)
      : 0;
  const deficitMi = Math.max(0, thisWeekTargetMi - thisWeekMi);

  const todayDay = weekView.find((d) => d.date_iso === todayISO) ?? null;
  const todayPlan = todayDay?.planned ?? null;
  // Once today's run is logged, the card shows its stats instead of reading
  // like a workout still to do.
  const todayDone =
    todayDay?.status === "done" && todayDay.actual ? todayDay.actual : null;
  const nextUp =
    todayPlan ??
    weekView.find((d) => d.date_iso > todayISO && d.planned)?.planned ??
    null;

  const recentDates = recent.map((a) => a.start_date_local.slice(0, 10)).sort();
  const recentMin = recentDates[0] ?? todayISO;
  const recentMax = recentDates[recentDates.length - 1] ?? todayISO;
  const plannedForRecent = await getPlannedRunsBetween(recentMin, recentMax);
  const typeByDate = new Map<string, WorkoutType>(
    plannedForRecent.map((p) => [p.scheduled_date, p.workout_type]),
  );

  const load7d = dailyLoad.slice(-7).reduce((a, b) => a + b, 0);
  const load28d = dailyLoad.reduce((a, b) => a + b, 0);
  const acwr = load28d > 0 ? +(load7d / (load28d / 4)).toFixed(2) : 0;
  const loadMax = Math.max(...dailyLoad, 1);

  const zonesTotalMin = zones.reduce((a, z) => a + z.minutes, 0);
  const zonesTotalLabel = `${Math.floor(zonesTotalMin / 60)}:${String(zonesTotalMin % 60).padStart(2, "0")} total`;

  const monthThis = monthly[monthly.length - 1] ?? {
    label: "—",
    miles: 0,
    runs: 0,
  };

  const peakWeek = weekMileage.reduce<{ label: string; miles: number } | null>(
    (best, w) => {
      const mi = metersToMiles(w.planned_m);
      if (!best || mi > best.miles) return { label: w.label, miles: mi };
      return best;
    },
    null,
  );

  const sessAdh =
    adherence.sessions.due > 0
      ? Math.round((adherence.sessions.done / adherence.sessions.due) * 100)
      : 0;
  const volAdh =
    adherence.volume.planned_m > 0
      ? Math.round(
          (adherence.volume.actual_m / adherence.volume.planned_m) * 100,
        )
      : 0;
  const workAdh =
    adherence.workouts.due > 0
      ? Math.round((adherence.workouts.done / adherence.workouts.due) * 100)
      : 0;

  const paceCurrent = paceTrend.filter((p) => p > 0).slice(-1)[0] ?? 0;
  const paceFirst = paceTrend.filter((p) => p > 0)[0] ?? 0;
  const paceDeltaSec =
    paceFirst > 0 && paceCurrent > 0
      ? Math.round((paceFirst - paceCurrent) * 60)
      : null;
  const fmtPaceMinDec = (v: number) => {
    const m = Math.floor(v);
    const s = Math.round((v - m) * 60);
    if (s === 60) return `${m + 1}:00`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const paceLabel = paceCurrent > 0 ? fmtPaceMinDec(paceCurrent) : "—";

  const paceNonZero = paceTrend.filter((p) => p > 0);
  let lastSeen = paceNonZero[0] ?? 0;
  const paceFilled = paceTrend.map((p) => {
    if (p > 0) lastSeen = p;
    return lastSeen;
  });
  const paceMin = paceNonZero.length > 0 ? Math.min(...paceNonZero) : 0;
  const paceMax = paceNonZero.length > 0 ? Math.max(...paceNonZero) : 1;
  const pacePad = Math.max((paceMax - paceMin) * 0.2, 0.25);
  const paceMinY = Math.max(0, paceMin - pacePad);
  const paceMaxY = paceMax + pacePad;

  const loadStripStart = new Date();
  loadStripStart.setUTCDate(loadStripStart.getUTCDate() - 27);
  const loadStripMid = new Date();
  loadStripMid.setUTCDate(loadStripMid.getUTCDate() - 14);

  const gearById = new Map(gear.map((g) => [g.id, g]));
  const nextUpShoe = nextUp?.expected_gear_id
    ? gearById.get(nextUp.expected_gear_id)
    : null;

  const sortedGear = [...gear].sort((a, b) => b.distance_m - a.distance_m);
  const nearRetirement = sortedGear.find((g) => g.distance_m / g.cap_m > 0.85);
  const remainingMi = nearRetirement
    ? Math.round(
        metersToMiles(nearRetirement.cap_m - nearRetirement.distance_m),
      )
    : 0;

  const raceDays = nextRace ? daysUntil(nextRace.race_date) : null;
  const raceWeeks =
    raceDays != null ? Math.max(0, Math.round(raceDays / 7)) : null;

  return (
    <div className="content ff">
      <header className="ff-head">
        <h1 className="ff-title">This week</h1>
        <span className="ff-caption">
          {currentWeek ? fmtDateRange(currentWeek.start_date) : "—"}
          {plan ? ` · Week ${planMeta.current_week_index + 1} of ${plan.name}` : ""}
        </span>
      </header>

      <div className="ff-board reveal-product">
        {/* ===== Row 1: week, adherence, today/next ===== */}
        <section
          className="ff-row"
          style={{
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)",
          }}
        >
          <div className="ff-cell">
            <div className="row between" style={{ alignItems: "flex-start" }}>
              <div className="col gap-4">
                <span className="ff-caption">Mileage</span>
                <div className="row baseline gap-8">
                  <span className="ff-display num">{thisWeekMi.toFixed(1)}</span>
                  <span className="ff-caption num">
                    of {thisWeekTargetMi.toFixed(0)} mi
                  </span>
                </div>
                {deficitMi > 0 && (
                  <span className="ff-caption" style={{ color: "var(--amber)" }}>
                    {deficitMi.toFixed(1)} mi to target
                  </span>
                )}
              </div>
              <Ring
                pct={thisWeekProgressPct}
                size={84}
                stroke={5}
                label="Progress"
                value={thisWeekProgressPct}
                unit="%"
              />
            </div>
            <div
              className="grid ff-split"
              style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}
            >
              <Stat
                label="Duration"
                value={formatDurationShort(weekStats.duration_s)}
              />
              <Stat
                label="Elevation"
                value={formatFeet(weekStats.elev_m)}
                unit="ft"
              />
              <Stat
                label="Avg HR"
                value={weekStats.avg_hr > 0 ? String(weekStats.avg_hr) : "—"}
                unit="bpm"
              />
              <Stat label="Runs" value={String(weekStats.runs)} unit="of 7" />
            </div>
          </div>

          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">Plan adherence</span>
            </div>
            <div className="row gap-16" style={{ alignItems: "center" }}>
              <Ring
                pct={planMeta.adherence_pct}
                size={76}
                stroke={5}
                label="On plan"
                value={planMeta.adherence_pct}
                unit="%"
              />
              <div className="col gap-10 grow">
                {[
                  {
                    label: "Sessions",
                    value: `${adherence.sessions.done}/${adherence.sessions.due}`,
                    pct: sessAdh,
                  },
                  {
                    label: "Volume",
                    value: `${Math.round(metersToMiles(adherence.volume.actual_m))}/${Math.round(metersToMiles(adherence.volume.planned_m))} mi`,
                    pct: volAdh,
                  },
                  {
                    label: "Workouts",
                    value: `${adherence.workouts.done}/${adherence.workouts.due}`,
                    pct: workAdh,
                  },
                ].map((r) => (
                  <div key={r.label} className="col gap-4">
                    <div className="row between baseline">
                      <span className="ff-caption">{r.label}</span>
                      <span className="num">{r.value}</span>
                    </div>
                    <div className="ff-meter">
                      <span
                        style={{
                          width: `${Math.min(100, r.pct)}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">
                {todayDone
                  ? `Today · ${fmtDate(todayISO)}`
                  : nextUp
                    ? `Next · ${fmtDate(nextUp.scheduled_date)}`
                    : "Next"}
              </span>
              {todayDone && (
                <span
                  className="row gap-4 ff-caption"
                  style={{ alignItems: "center", color: "var(--accent)" }}
                >
                  <Icon name="check" size={12} />
                  Done
                </span>
              )}
            </div>
            {todayDone ? (
              <Link
                href={`/activities/${todayDone.id}`}
                className="col gap-12"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <div className="row gap-8" style={{ alignItems: "center" }}>
                  {todayPlan && <TypePill type={todayPlan.workout_type} />}
                  <span
                    className="ff-muted"
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {todayPlan?.description ?? todayDone.name}
                  </span>
                </div>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
                >
                  <Stat
                    label="Distance"
                    value={formatMiles(todayDone.distance_m)}
                    unit="mi"
                  />
                  <Stat
                    label="Pace"
                    value={speedToPacePerMile(todayDone.average_speed_ms)}
                    unit="/mi"
                  />
                  <Stat
                    label="Time"
                    value={formatDurationShort(todayDone.moving_time_s)}
                  />
                  <Stat
                    label="Avg HR"
                    value={
                      todayDone.average_heartrate
                        ? String(Math.round(todayDone.average_heartrate))
                        : "—"
                    }
                    unit="bpm"
                  />
                </div>
              </Link>
            ) : nextUp ? (
              <div className="col gap-10">
                <div className="ff-display" style={{ fontSize: "var(--fs-title)", lineHeight: "var(--lh-title)", fontVariationSettings: "var(--fw-semibold)" }}>
                  {nextUp.description ?? "—"}
                </div>
                <div className="row gap-8" style={{ alignItems: "center" }}>
                  <TypePill type={nextUp.workout_type} />
                  {nextUp.target_distance_m && (
                    <span className="ff-caption num">
                      {formatMiles(nextUp.target_distance_m)} mi
                    </span>
                  )}
                  {nextUpShoe && (
                    <span
                      className="row gap-6 ff-caption"
                      style={{ alignItems: "center", marginLeft: "auto" }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background: nextUpShoe.color,
                          flexShrink: 0,
                        }}
                      />
                      {nextUpShoe.model_name ?? nextUpShoe.name}
                    </span>
                  )}
                </div>
                {nextUp.notes && <div className="ff-caption">{nextUp.notes}</div>}
              </div>
            ) : (
              <div className="ff-muted">No upcoming workouts this week.</div>
            )}
          </div>
        </section>

        {/* ===== Row 2: load, zones, month ===== */}
        <section
          className="ff-row"
          style={{
            gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 0.9fr)",
          }}
        >
          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">Daily load</span>
              <span className="ff-caption">Last 28 days · max {loadMax}</span>
            </div>
            <LoadStrip data={dailyLoad} height={56} />
            <div className="row between ff-caption" style={{ marginTop: 8 }}>
              <span>{fmtDate(loadStripStart.toISOString().slice(0, 10))}</span>
              <span>{fmtDate(loadStripMid.toISOString().slice(0, 10))}</span>
              <span>{fmtDate(todayISO)}</span>
            </div>
            <div
              className="grid ff-split"
              style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}
            >
              <Stat label="7-day load" value={String(load7d)} />
              <Stat label="28-day load" value={load28d.toLocaleString()} />
              <div className="col">
                <div className="stat-label">ACWR</div>
                <span className="stat-num num" style={{ color: "var(--accent)" }}>
                  {acwr || "—"}
                </span>
              </div>
              <Stat label="Streak" value={String(streak)} unit="days" />
            </div>
          </div>

          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">Heart rate zones</span>
              <span className="ff-caption">7 days · {zonesTotalLabel}</span>
            </div>
            <ZoneBar zones={zones} showLabels={false} />
            <div className="col" style={{ marginTop: 12 }}>
              {zones.map((z, i) => (
                <div key={z.zone} className="row between" style={{ padding: "2px 0" }}>
                  <span className="row gap-8" style={{ alignItems: "center" }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: `var(--zone-${i + 1})`,
                      }}
                    />
                    {z.zone}
                    <span className="ff-muted">{z.label}</span>
                  </span>
                  <span className="num">{z.minutes}m</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">{monthThis.label}</span>
            </div>
            <Stat
              label="Distance"
              value={monthThis.miles.toFixed(1)}
              unit="mi"
              size="lg"
            />
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 16 }}
            >
              <Stat label="Runs" value={String(monthThis.runs)} />
              <Stat
                label="Time"
                value={formatDurationShort(weekStats.duration_s)}
              />
            </div>
            <div className="ff-split">
              <Sparkline data={monthly.map((m) => m.miles)} height={32} />
              <div className="row between ff-caption" style={{ marginTop: 6 }}>
                <span>{monthly[0]?.label ?? ""}</span>
                <span>{monthly[monthly.length - 1]?.label ?? ""}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Row 3: weekly mileage, easy pace ===== */}
        <section
          className="ff-row"
          style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}
        >
          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">Weekly mileage</span>
              <span className="row gap-14" style={{ alignItems: "center" }}>
                <span className="pill-dot" style={{ color: "var(--accent)" }}>
                  Actual
                </span>
                <span className="pill-dot" style={{ color: "var(--text-2)" }}>
                  Planned
                </span>
                {peakWeek && (
                  <span className="ff-caption num">
                    Peak {peakWeek.label} · {peakWeek.miles.toFixed(0)} mi
                  </span>
                )}
              </span>
            </div>
            <MileageBars
              weeks={weekMileage}
              width={820}
              height={180}
              currentIndex={planMeta.current_week_index}
            />
          </div>

          <div className="ff-cell">
            <div className="ff-cell-head" style={{ alignItems: "flex-start" }}>
              <span className="ff-h">Easy pace</span>
              <div className="col" style={{ alignItems: "flex-end" }}>
                <span className="row baseline gap-4">
                  <span className="stat-num num">{paceLabel}</span>
                  <span className="ff-caption">/mi</span>
                </span>
                {paceDeltaSec != null && (
                  <span
                    className="ff-caption num"
                    style={{
                      color: paceDeltaSec >= 0 ? "var(--accent)" : "var(--red)",
                    }}
                  >
                    {paceDeltaSec >= 0 ? "−" : "+"}
                    {Math.abs(paceDeltaSec)}s vs 12 weeks
                  </span>
                )}
              </div>
            </div>
            <div style={{ height: 160, overflow: "clip" }}>
              {paceNonZero.length > 0 ? (
                <LineChart
                  data={paceFilled}
                  width={360}
                  height={160}
                  padL={44}
                  padR={12}
                  padB={14}
                  padT={12}
                  invertY
                  minY={paceMinY}
                  maxY={paceMaxY}
                  yTicks={2}
                  formatY="pace"
                />
              ) : (
                <div
                  className="ff-muted"
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  No runs in the last 12 weeks.
                </div>
              )}
            </div>
            <div
              className="grid ff-split"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
            >
              <Stat
                label="Resting HR"
                value={
                  recovery?.resting_heart_rate != null
                    ? String(Math.round(Number(recovery.resting_heart_rate)))
                    : "—"
                }
                unit="bpm"
              />
              <Stat
                label="HRV"
                value={
                  recovery?.hrv_rmssd_milli != null
                    ? String(Math.round(Number(recovery.hrv_rmssd_milli)))
                    : "—"
                }
                unit="ms"
              />
            </div>
          </div>
        </section>

        {/* ===== Row 4: recent runs, shoes, next race ===== */}
        <section
          className="ff-row"
          style={{
            gridTemplateColumns: nextRace
              ? "minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr)"
              : "minmax(0, 1.5fr) minmax(0, 1fr)",
            borderBottom: "none",
          }}
        >
          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">Recent runs</span>
              <Link href="/activities" className="card-action">
                View all
              </Link>
            </div>
            {recent.length > 0 ? (
              <FluidList>
                {recent.map((a, i) => {
                  const plannedType = typeByDate.get(
                    a.start_date_local.slice(0, 10),
                  );
                  const label = labelForActivity(plannedType, a.name);
                  return (
                    <FluidRow
                      key={a.id}
                      index={i}
                      href={`/activities/${a.id}`}
                      className="ff-activity-row"
                    >
                      <RouteThumb
                        polyline={a.summary_polyline}
                        seed={i * 7 + 3}
                        size={36}
                      />
                      <span className="col" style={{ minWidth: 0 }}>
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {a.name}
                        </span>
                        <span className="ff-caption num">
                          {fmtDate(a.start_date_local.slice(0, 10))} ·{" "}
                          {a.start_date_local.slice(11, 16)}
                        </span>
                      </span>
                      <TypePill type={label} />
                      <span className="num ff-row-muted" style={{ textAlign: "right" }}>
                        {formatMiles(a.distance_m)} mi
                      </span>
                      <span className="num ff-row-muted" style={{ textAlign: "right" }}>
                        {speedToPacePerMile(a.average_speed_ms)}
                      </span>
                      <span className="num ff-row-muted" style={{ textAlign: "right" }}>
                        {a.average_heartrate ? Math.round(a.average_heartrate) : "—"}
                      </span>
                    </FluidRow>
                  );
                })}
              </FluidList>
            ) : (
              <div className="ff-muted">No activities yet — sync from Strava.</div>
            )}
          </div>

          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">Shoes</span>
              <span className="ff-caption">{gear.length} active</span>
            </div>
            {sortedGear.length > 0 ? (
              <FluidList>
                {sortedGear.slice(0, 3).map((s, i) => (
                  <FluidRow key={s.id} index={i} href="/shoes" className="ff-shoe-row">
                    <span className="row between" style={{ gap: 12 }}>
                      <span
                        className="row gap-8"
                        style={{ alignItems: "center", minWidth: 0 }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: s.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {s.name}
                        </span>
                      </span>
                      <span className="num ff-row-muted" style={{ flexShrink: 0 }}>
                        {formatMilesHalf(metersToMiles(s.distance_m))} /{" "}
                        {formatMilesHalf(metersToMiles(s.cap_m))} mi
                      </span>
                    </span>
                    <span className="ff-meter">
                      <span
                        style={{
                          width: `${Math.min(100, (s.distance_m / s.cap_m) * 100)}%`,
                          background: s.color,
                        }}
                      />
                    </span>
                  </FluidRow>
                ))}
              </FluidList>
            ) : (
              <div className="ff-muted">No active shoes synced.</div>
            )}
            {nearRetirement && (
              <div className="ff-caption ff-split" style={{ color: "var(--amber)" }}>
                {nearRetirement.name} is near retirement · {remainingMi} mi left
              </div>
            )}
          </div>

          {nextRace && (
            <div className="ff-cell">
              <div className="ff-cell-head">
                <span className="ff-h">Next race</span>
                {raceWeeks != null && (
                  <span className="ff-caption">
                    {raceWeeks} {raceWeeks === 1 ? "week" : "weeks"}
                  </span>
                )}
              </div>
              <div className="col gap-4">
                <span
                  style={{
                    fontSize: "var(--fs-title)",
                    lineHeight: "var(--lh-title)",
                    fontVariationSettings: "var(--fw-semibold)",
                  }}
                >
                  {nextRace.name}
                </span>
                <span className="ff-caption">
                  {fmtDate(nextRace.race_date)}
                  {nextRace.location ? ` · ${nextRace.location}` : ""}
                </span>
              </div>
              <div
                className="grid ff-split"
                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}
              >
                <Stat
                  label="Distance"
                  value={formatMiles(nextRace.distance_m, 1)}
                  unit="mi"
                />
                <Stat label="Goal" value={fmtGoalTime(nextRace.goal_time_s)} />
                <Stat
                  label="Pace"
                  value={paceFromGoal(nextRace.distance_m, nextRace.goal_time_s)}
                  unit="/mi"
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
