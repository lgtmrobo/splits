import Link from "next/link";
import { MileageBars } from "@/components/charts/mileage-bars";
import { ZoneBar } from "@/components/charts/zone-bar";
import { FluidList, FluidRow } from "@/components/fluid/fluid-list";
import { RouteThumb } from "@/components/maps/route-thumb";
import { Icon } from "@/components/ui/icon";
import { Stat } from "@/components/ui/primitives";
import { TypePill } from "@/components/ui/type-pill";
import {
  getActiveGear,
  getActivePlan,
  getNextARace,
  getPlanAdherenceBreakdown,
  getPlanMeta,
  getPlannedRunsBetween,
  getRecentActivities,
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
  const [planMeta, plan, weekMileage, recent, gear, nextRace, adherence, zones] =
    await Promise.all([
      getPlanMeta(),
      getActivePlan(),
      getWeekMileage(),
      getRecentActivities(5),
      getActiveGear(),
      getNextARace(),
      getPlanAdherenceBreakdown(),
      getWeekHRZones(),
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
  const leftMi = Math.max(0, thisWeekTargetMi - thisWeekMi);

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
  const plannedForRecent = await getPlannedRunsBetween(
    recentDates[0] ?? todayISO,
    recentDates[recentDates.length - 1] ?? todayISO,
  );
  const typeByDate = new Map<string, WorkoutType>(
    plannedForRecent.map((p) => [p.scheduled_date, p.workout_type]),
  );

  const pct = (done: number, due: number) =>
    due > 0 ? Math.round((done / due) * 100) : 0;
  const adherenceRows = [
    {
      label: "Sessions",
      value: `${adherence.sessions.done}/${adherence.sessions.due}`,
      pct: pct(adherence.sessions.done, adherence.sessions.due),
    },
    {
      label: "Volume",
      value: `${Math.round(metersToMiles(adherence.volume.actual_m))}/${Math.round(metersToMiles(adherence.volume.planned_m))} mi`,
      pct: pct(adherence.volume.actual_m, adherence.volume.planned_m),
    },
    {
      label: "Workouts",
      value: `${adherence.workouts.done}/${adherence.workouts.due}`,
      pct: pct(adherence.workouts.done, adherence.workouts.due),
    },
  ];

  const zonesTotalMin = zones.reduce((a, z) => a + z.minutes, 0);
  const zonesTotalLabel = `${Math.floor(zonesTotalMin / 60)}:${String(zonesTotalMin % 60).padStart(2, "0")} total`;

  const gearById = new Map(gear.map((g) => [g.id, g]));
  const nextUpShoe = nextUp?.expected_gear_id
    ? gearById.get(nextUp.expected_gear_id)
    : null;
  const sortedGear = [...gear].sort((a, b) => b.distance_m - a.distance_m);
  const nearRetirement = sortedGear.find((g) => g.distance_m / g.cap_m > 0.85);

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
        {/* ===== This week + today/next ===== */}
        <section
          className="ff-row"
          style={{
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)",
          }}
        >
          <div className="ff-cell">
            <span className="ff-caption">Mileage</span>
            <div className="row baseline gap-8" style={{ marginTop: 4 }}>
              <span className="ff-hero num">{thisWeekMi.toFixed(1)}</span>
              <span className="ff-muted num">
                of {thisWeekTargetMi.toFixed(0)} mi
              </span>
            </div>
            <div className="ff-meter" style={{ marginTop: 16 }}>
              <span
                style={{
                  width: `${Math.min(100, thisWeekProgressPct)}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
            <div className="row between ff-caption num" style={{ marginTop: 8 }}>
              <span>{thisWeekProgressPct}% done</span>
              <span>{leftMi > 0 ? `${leftMi.toFixed(1)} mi to go` : "Target hit"}</span>
            </div>
            <div
              className="grid ff-split"
              style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}
            >
              <Stat label="Time" value={formatDurationShort(weekStats.duration_s)} />
              <Stat label="Elevation" value={formatFeet(weekStats.elev_m)} unit="ft" />
              <Stat
                label="Avg HR"
                value={weekStats.avg_hr > 0 ? String(weekStats.avg_hr) : "—"}
                unit="bpm"
              />
              <Stat label="Runs" value={String(weekStats.runs)} />
            </div>
          </div>

          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">Plan adherence</span>
              <span className="ff-caption num">{planMeta.adherence_pct}%</span>
            </div>
            <div className="col gap-14">
              {adherenceRows.map((r) => (
                <div key={r.label} className="col gap-6">
                  <div className="row between baseline">
                    <span className="ff-muted">{r.label}</span>
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
                  <span className="ff-muted ff-ellipsis">
                    {todayPlan?.description ?? todayDone.name}
                  </span>
                </div>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
                >
                  <Stat label="Distance" value={formatMiles(todayDone.distance_m)} unit="mi" />
                  <Stat
                    label="Pace"
                    value={speedToPacePerMile(todayDone.average_speed_ms)}
                    unit="/mi"
                  />
                </div>
              </Link>
            ) : nextUp ? (
              <div className="col gap-12">
                <div className="ff-next">{nextUp.description ?? "—"}</div>
                <div className="row gap-8" style={{ alignItems: "center" }}>
                  <TypePill type={nextUp.workout_type} />
                  {nextUpShoe && (
                    <span
                      className="row gap-6 ff-caption"
                      style={{ alignItems: "center" }}
                    >
                      <span
                        className="ff-dot"
                        style={{ background: nextUpShoe.color }}
                      />
                      {nextUpShoe.model_name ?? nextUpShoe.name}
                    </span>
                  )}
                </div>
                {nextUp.notes && <div className="ff-caption">{nextUp.notes}</div>}
              </div>
            ) : (
              <div className="ff-muted">Nothing else planned this week.</div>
            )}
          </div>
        </section>

        {/* ===== Plan ===== */}
        <section
          className="ff-row"
          style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)" }}
        >
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
                      className="ff-dot"
                      style={{ background: `var(--zone-${i + 1})` }}
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
              <span className="ff-h">Weekly mileage</span>
              <span className="row gap-14" style={{ alignItems: "center" }}>
                <span className="pill-dot" style={{ color: "var(--accent)" }}>
                  Actual
                </span>
                <span className="pill-dot" style={{ color: "var(--text-2)" }}>
                  Planned
                </span>
              </span>
            </div>
            <MileageBars
              weeks={weekMileage}
              width={820}
              height={160}
              currentIndex={planMeta.current_week_index}
            />
          </div>
        </section>

        {/* ===== Recent runs, shoes, next race ===== */}
        <section
          className="ff-row"
          style={{
            gridTemplateColumns: nextRace
              ? "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr)"
              : "minmax(0, 1.6fr) minmax(0, 1fr)",
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
                {recent.map((a, i) => (
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
                      <span className="ff-ellipsis">{a.name}</span>
                      <span className="ff-caption num">
                        {fmtDate(a.start_date_local.slice(0, 10))} ·{" "}
                        {a.start_date_local.slice(11, 16)}
                      </span>
                    </span>
                    <TypePill
                      type={labelForActivity(
                        typeByDate.get(a.start_date_local.slice(0, 10)),
                        a.name,
                      )}
                    />
                    <span className="num ff-row-muted" style={{ textAlign: "right" }}>
                      {formatMiles(a.distance_m)} mi
                    </span>
                    <span className="num ff-row-muted" style={{ textAlign: "right" }}>
                      {speedToPacePerMile(a.average_speed_ms)}
                    </span>
                  </FluidRow>
                ))}
              </FluidList>
            ) : (
              <div className="ff-muted">No activities yet — sync from Strava.</div>
            )}
          </div>

          <div className="ff-cell">
            <div className="ff-cell-head">
              <span className="ff-h">Shoes</span>
              <Link href="/shoes" className="card-action">
                {gear.length} active
              </Link>
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
                        <span className="ff-dot" style={{ background: s.color }} />
                        <span className="ff-ellipsis">{s.name}</span>
                      </span>
                      <span className="num ff-row-muted" style={{ flexShrink: 0 }}>
                        {formatMilesHalf(metersToMiles(s.distance_m))} /{" "}
                        {formatMilesHalf(metersToMiles(s.cap_m))}
                      </span>
                    </span>
                    <span className="ff-meter">
                      <span
                        style={{
                          width: `${Math.min(100, (s.distance_m / s.cap_m) * 100)}%`,
                          background:
                            s.id === nearRetirement?.id ? "var(--amber)" : s.color,
                        }}
                      />
                    </span>
                  </FluidRow>
                ))}
              </FluidList>
            ) : (
              <div className="ff-muted">No active shoes synced.</div>
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
                <span className="ff-next">{nextRace.name}</span>
                <span className="ff-caption">
                  {fmtDate(nextRace.race_date)}
                  {nextRace.location ? ` · ${nextRace.location}` : ""}
                </span>
              </div>
              <div
                className="grid ff-split"
                style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
              >
                <Stat
                  label="Distance"
                  value={formatMiles(nextRace.distance_m, 1)}
                  unit="mi"
                />
                <Stat label="Goal" value={fmtGoalTime(nextRace.goal_time_s)} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
