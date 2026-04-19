import Link from "next/link";
import { LineChart } from "@/components/charts/line-chart";
import { LoadStrip } from "@/components/charts/load-strip";
import { MileageBars } from "@/components/charts/mileage-bars";
import { MilesBar } from "@/components/charts/miles-bar";
import { Ring } from "@/components/charts/ring";
import { Sparkline } from "@/components/charts/sparkline";
import { ZoneBar } from "@/components/charts/zone-bar";
import { RouteThumb } from "@/components/maps/route-thumb";
import { Icon } from "@/components/ui/icon";
import { CardHeader, Pill, Stat } from "@/components/ui/primitives";
import {
  getActiveGear,
  getActivePlan,
  getDailyLoad28d,
  getMonthlyStats,
  getNextARace,
  getPaceTrend12w,
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
  metersToMiles,
  speedToPacePerMile,
} from "@/lib/utils/units";
import { todayLocalISO } from "@/lib/utils/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
function labelForActivity(planned: WorkoutType | undefined, name: string): string {
  if (planned === "long") return "Long";
  if (planned === "interval" || planned === "tempo" || planned === "workout") return "Workout";
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
  const d = Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10));
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.round((d - t) / 86400_000);
}

export default async function DashboardPage() {
  const [planMeta, plan, weekMileage, dailyLoad, zones, recent, gear, paceTrend, monthly, nextRace, adherence, streak] = await Promise.all([
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
  ]);

  const currentWeek = weekMileage[planMeta.current_week_index] ?? weekMileage[weekMileage.length - 1] ?? null;
  const todayISO = todayLocalISO();
  const weekStartISO = currentWeek?.start_date ?? todayISO;
  const [weekStats, weekView] = await Promise.all([getWeekStats(weekStartISO), getWeekView(weekStartISO)]);

  const thisWeekMi = metersToMiles(weekStats.distance_m);
  const thisWeekTargetMi = currentWeek ? metersToMiles(currentWeek.planned_m) : 0;
  const thisWeekProgressPct = thisWeekTargetMi > 0 ? Math.round((thisWeekMi / thisWeekTargetMi) * 100) : 0;
  const deficitMi = Math.max(0, thisWeekTargetMi - thisWeekMi);

  const todayPlan = weekView.find((d) => d.date_iso === todayISO)?.planned ?? null;
  const nextUp = todayPlan ?? weekView.find((d) => d.date_iso > todayISO && d.planned)?.planned ?? null;

  const recentDates = recent.map((a) => a.start_date_local.slice(0, 10)).sort();
  const recentMin = recentDates[0] ?? todayISO;
  const recentMax = recentDates[recentDates.length - 1] ?? todayISO;
  const plannedForRecent = await getPlannedRunsBetween(recentMin, recentMax);
  const typeByDate = new Map<string, WorkoutType>(plannedForRecent.map((p) => [p.scheduled_date, p.workout_type]));

  const load7d = dailyLoad.slice(-7).reduce((a, b) => a + b, 0);
  const load28d = dailyLoad.reduce((a, b) => a + b, 0);
  const acwr = load28d > 0 ? +(load7d / (load28d / 4)).toFixed(2) : 0;
  const loadMax = Math.max(...dailyLoad, 1);

  const zonesTotalMin = zones.reduce((a, z) => a + z.minutes, 0);
  const zonesTotalLabel = `${Math.floor(zonesTotalMin / 60)}:${String(zonesTotalMin % 60).padStart(2, "0")} total`;

  const monthThis = monthly[monthly.length - 1] ?? { label: "—", miles: 0, runs: 0 };

  const peakWeek = weekMileage.reduce<{ label: string; miles: number } | null>((best, w) => {
    const mi = metersToMiles(w.planned_m);
    if (!best || mi > best.miles) return { label: w.label, miles: mi };
    return best;
  }, null);

  const sessAdh = adherence.sessions.due > 0 ? Math.round((adherence.sessions.done / adherence.sessions.due) * 100) : 0;
  const volAdh = adherence.volume.planned_m > 0 ? Math.round((adherence.volume.actual_m / adherence.volume.planned_m) * 100) : 0;
  const workAdh = adherence.workouts.due > 0 ? Math.round((adherence.workouts.done / adherence.workouts.due) * 100) : 0;

  const paceCurrent = paceTrend.filter((p) => p > 0).slice(-1)[0] ?? 0;
  const paceFirst = paceTrend.filter((p) => p > 0)[0] ?? 0;
  const paceDeltaSec = paceFirst > 0 && paceCurrent > 0 ? Math.round((paceFirst - paceCurrent) * 60) : null;
  const paceLabel = paceCurrent > 0
    ? `${Math.floor(paceCurrent)}:${String(Math.round((paceCurrent % 1) * 60)).padStart(2, "0")}`
    : "—";

  const loadStripStart = new Date();
  loadStripStart.setUTCDate(loadStripStart.getUTCDate() - 27);
  const loadStripMid = new Date();
  loadStripMid.setUTCDate(loadStripMid.getUTCDate() - 14);

  const sortedGear = [...gear].sort((a, b) => b.distance_m - a.distance_m);
  const nearRetirement = sortedGear.find((g) => g.distance_m / g.cap_m > 0.85);
  const remainingMi = nearRetirement ? Math.round(metersToMiles(nearRetirement.cap_m - nearRetirement.distance_m)) : 0;

  const raceDays = nextRace ? daysUntil(nextRace.race_date) : null;
  const raceWeeks = raceDays != null ? Math.max(0, Math.round(raceDays / 7)) : null;

  return (
    <div className="content fadein">
      {/* ===== Row 1 ===== */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr", marginBottom: 14 }}>
        <div className="card">
          <div className="row between" style={{ marginBottom: 16 }}>
            <div className="col gap-4">
              <div className="stat-label" style={{ marginBottom: 0 }}>
                This Week · {currentWeek ? fmtDateRange(currentWeek.start_date) : "—"}
              </div>
              <div className="row baseline gap-10">
                <span className="stat-num xl">{thisWeekMi.toFixed(1)}</span>
                <span className="stat-unit" style={{ fontSize: 13 }}>mi</span>
                <span className="muted num" style={{ fontSize: 13, marginLeft: 8 }}>
                  of {thisWeekTargetMi.toFixed(0)}
                </span>
                {deficitMi > 0 && <Pill kind="warn">−{deficitMi.toFixed(1)} mi to target</Pill>}
              </div>
            </div>
            <Ring pct={thisWeekProgressPct} size={96} stroke={6} label="progress" value={thisWeekProgressPct} unit="%" />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
            <Stat label="Duration" value={formatDurationShort(weekStats.duration_s)} />
            <Stat label="Elevation" value={formatFeet(weekStats.elev_m)} unit="ft" />
            <Stat label="Avg HR" value={weekStats.avg_hr > 0 ? String(weekStats.avg_hr) : "—"} unit="bpm" />
            <Stat label="Runs" value={String(weekStats.runs)} unit="/7" />
          </div>
        </div>

        <div className="card">
          <CardHeader title="Plan Adherence" action={plan ? `W${planMeta.current_week_index + 1} · ${plan.name}` : "—"} />
          <div className="row gap-14" style={{ alignItems: "center" }}>
            <Ring pct={planMeta.adherence_pct} size={84} stroke={6} label="on plan" value={planMeta.adherence_pct} unit="%" />
            <div className="col gap-8 grow">
              {[
                { label: "Sessions", value: `${adherence.sessions.done}/${adherence.sessions.due}`, pct: sessAdh },
                { label: "Volume", value: `${Math.round(metersToMiles(adherence.volume.actual_m))}/${Math.round(metersToMiles(adherence.volume.planned_m))}`, pct: volAdh },
                { label: "Workouts", value: `${adherence.workouts.done}/${adherence.workouts.due}`, pct: workAdh },
              ].map((r) => (
                <div key={r.label} className="col gap-4">
                  <div className="row between baseline">
                    <span className="muted num" style={{ fontSize: 11 }}>{r.label}</span>
                    <span className="num" style={{ fontSize: 13 }}>{r.value}</span>
                  </div>
                  <div style={{ height: 3, background: "var(--surface-3)", borderRadius: 2 }}>
                    <div style={{ width: `${Math.min(100, r.pct)}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ background: "linear-gradient(135deg, var(--surface-1), var(--surface-2))" }}>
          <CardHeader title={nextUp ? `Next · ${fmtDate(nextUp.scheduled_date)}` : "Next · —"} accent />
          <div className="col gap-8">
            {nextUp ? (
              <>
                <div className="row gap-8 baseline">
                  <Pill kind="accent">{nextUp.workout_type}</Pill>
                  {nextUp.target_distance_m && (
                    <span className="muted num" style={{ fontSize: 11 }}>{formatMiles(nextUp.target_distance_m)} mi</span>
                  )}
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.3, color: "var(--text-1)", fontWeight: 500 }}>
                  {nextUp.description ?? "—"}
                </div>
                {nextUp.notes && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{nextUp.notes}</div>
                )}
              </>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>No upcoming workouts this week.</div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Row 2 ===== */}
      <div className="grid" style={{ gridTemplateColumns: "1.8fr 1fr 0.9fr", marginBottom: 14 }}>
        <div className="card">
          <CardHeader title="Daily Load · Last 28 Days" action={`MIN · 0   MAX · ${loadMax}`} />
          <LoadStrip data={dailyLoad} height={56} />
          <div className="row between" style={{ marginTop: 10, fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span>{fmtDate(loadStripStart.toISOString().slice(0, 10))}</span>
            <span>{fmtDate(loadStripMid.toISOString().slice(0, 10))}</span>
            <span>{fmtDate(todayISO)}</span>
          </div>
          <div className="row gap-14" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
            <div className="col gap-4">
              <span className="stat-label" style={{ marginBottom: 0 }}>7d Load</span>
              <span className="num" style={{ fontSize: 16 }}>{load7d}</span>
            </div>
            <div className="col gap-4">
              <span className="stat-label" style={{ marginBottom: 0 }}>28d Load</span>
              <span className="num" style={{ fontSize: 16 }}>{load28d.toLocaleString()}</span>
            </div>
            <div className="col gap-4">
              <span className="stat-label" style={{ marginBottom: 0 }}>ACWR</span>
              <span className="num" style={{ fontSize: 16, color: "var(--accent)" }}>{acwr || "—"}</span>
            </div>
            <div className="col gap-4">
              <span className="stat-label" style={{ marginBottom: 0 }}>Streak</span>
              <span className="num" style={{ fontSize: 16 }}>{streak}<span className="muted" style={{ fontSize: 11 }}>d</span></span>
            </div>
          </div>
        </div>

        <div className="card">
          <CardHeader title="Time in HR Zones · 7d" action={zonesTotalLabel} />
          <div style={{ marginTop: 6, marginBottom: 10 }}>
            <ZoneBar zones={zones} />
          </div>
          <div className="col gap-4" style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, color: "var(--text-2)" }}>
            {zones.map((z, i) => (
              <div key={z.zone} className="row between">
                <span>
                  <span style={{ color: `var(--zone-${i + 1})` }}>■</span> {z.zone} <span className="muted">{z.label}</span>
                </span>
                <span>{z.minutes}m</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <CardHeader title={`Monthly Totals · ${monthThis.label}`} />
          <Stat label="Distance" value={monthThis.miles.toFixed(1)} unit="mi" size="lg" />
          <div style={{ height: 14 }} />
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Stat label="Runs" value={String(monthThis.runs)} />
            <Stat label="Time" value={formatDurationShort(weekStats.duration_s)} />
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--hairline)" }}>
            <Sparkline data={monthly.map((m) => m.miles)} height={32} />
            <div className="row between" style={{ marginTop: 6, fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-3)" }}>
              <span>{monthly[0]?.label ?? ""}</span>
              <span>{monthly[monthly.length - 1]?.label ?? ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Row 3 ===== */}
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 14 }}>
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="col gap-4">
              <div className="stat-label" style={{ marginBottom: 0 }}>Weekly Mileage · Plan vs Actual</div>
              <div className="row gap-14" style={{ marginTop: 4 }}>
                <span className="pill-dot" style={{ color: "var(--accent)" }}>Actual</span>
                <span className="pill-dot" style={{ color: "var(--text-3)" }}>Planned</span>
                {peakWeek && (
                  <span className="muted num" style={{ fontSize: 11 }}>· Peak: {peakWeek.label} ({peakWeek.miles.toFixed(0)}mi)</span>
                )}
              </div>
            </div>
          </div>
          <MileageBars weeks={weekMileage} width={820} height={180} currentIndex={planMeta.current_week_index} />
        </div>

        <div className="card">
          <CardHeader title="Easy Pace · 12w Trend" />
          <Stat
            label="Current"
            value={paceLabel}
            unit="/mi"
            size="lg"
            delta={paceDeltaSec != null ? `${paceDeltaSec >= 0 ? "−" : "+"}${Math.abs(paceDeltaSec)}s vs 12w` : undefined}
            deltaKind={paceDeltaSec != null && paceDeltaSec >= 0 ? "up" : "down"}
          />
          <div style={{ marginTop: 14, height: 110 }}>
            <LineChart data={paceTrend.map((p) => p || 0)} width={280} height={110} padL={28} padB={18} padT={10} invertY unit=":00" />
          </div>
          <div className="row between" style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid var(--hairline)" }}>
            <Stat label="Resting HR" value="—" unit="bpm" />
            <Stat label="VO₂ est." value="—" />
          </div>
        </div>
      </div>

      {/* ===== Row 4 ===== */}
      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="row between" style={{ padding: "16px 20px 10px" }}>
            <div className="card-title">Recent Activities</div>
            <Link href="/activities" className="card-action">View all →</Link>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>Date</th>
                <th>Name</th>
                <th>Type</th>
                <th className="num">Dist</th>
                <th className="num">Pace</th>
                <th className="num">HR</th>
                <th className="num">Elev</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a, i) => {
                const plannedType = typeByDate.get(a.start_date_local.slice(0, 10));
                const label = labelForActivity(plannedType, a.name);
                return (
                <tr key={a.id} className="clickable">
                  <td style={{ width: 80 }}>
                    <Link href={`/activities/${a.id}`}>
                      <RouteThumb polyline={a.summary_polyline} seed={i * 7 + 3} size={48} />
                    </Link>
                  </td>
                  <td className="num" style={{ color: "var(--text-3)", fontSize: 11 }}>
                    {a.start_date_local.slice(5, 10)}
                    <br />
                    <span style={{ fontSize: 10, color: "var(--text-4)" }}>{a.start_date_local.slice(11, 16)}</span>
                  </td>
                  <td>
                    <Link href={`/activities/${a.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      <div style={{ fontSize: 13, lineHeight: 1.3 }}>{a.name}</div>
                      <div className="muted num" style={{ fontSize: 10 }}>{a.sport_type}</div>
                    </Link>
                  </td>
                  <td>
                    <Pill kind={label === "Workout" || label === "Fartlek" ? "accent" : label === "Long" ? "default" : "muted"}>
                      {label}
                    </Pill>
                  </td>
                  <td className="num">{formatMiles(a.distance_m)}</td>
                  <td className="num">{speedToPacePerMile(a.average_speed_ms)}</td>
                  <td className="num">{a.average_heartrate ?? "—"}</td>
                  <td className="num">{formatFeet(a.total_elevation_gain_m)}</td>
                </tr>
                );
              })}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: 20, textAlign: "center" }}>
                    No activities yet — sync from Strava.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <CardHeader title="Shoe Rotation" action={`${gear.length} active`} />
          <div className="col gap-12">
            {sortedGear.slice(0, 3).map((s) => (
              <div key={s.id} className="col gap-6">
                <div className="row between">
                  <div className="row gap-8">
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                    <span style={{ fontSize: 13 }}>{s.name}</span>
                  </div>
                  <span className="num muted" style={{ fontSize: 11 }}>
                    {Math.round(metersToMiles(s.distance_m))}/{Math.round(metersToMiles(s.cap_m))} mi
                  </span>
                </div>
                <MilesBar miles={metersToMiles(s.distance_m)} cap={metersToMiles(s.cap_m)} color={s.color} />
              </div>
            ))}
            {sortedGear.length === 0 && (
              <div className="muted" style={{ fontSize: 12 }}>No active shoes synced.</div>
            )}
          </div>
          {nearRetirement && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
              <div className="row gap-8 baseline">
                <Icon name="zap" size={14} />{" "}
                <span className="pill warn">{nearRetirement.name} approaching retirement — {remainingMi}mi left</span>
              </div>
            </div>
          )}
        </div>

        {nextRace && (
          <div className="card">
            <CardHeader title="Next Race" action={raceWeeks != null ? `${raceWeeks} weeks` : ""} />
            <div className="col gap-6">
              <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>{nextRace.name}</div>
              <div className="row gap-8 baseline">
                <span className="muted num" style={{ fontSize: 11 }}>
                  {fmtDate(nextRace.race_date)}{nextRace.location ? ` · ${nextRace.location}` : ""}
                </span>
                {nextRace.priority && <Pill kind="accent">{nextRace.priority}</Pill>}
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
              <Stat label="Distance" value={formatMiles(nextRace.distance_m, 1)} unit="mi" />
              <Stat label="Goal" value={fmtGoalTime(nextRace.goal_time_s)} />
              <Stat label="Pace" value={paceFromGoal(nextRace.distance_m, nextRace.goal_time_s)} unit="/mi" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
