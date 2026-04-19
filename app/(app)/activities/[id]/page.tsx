import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart } from "@/components/charts/line-chart";
import { ZoneBar } from "@/components/charts/zone-bar";
import { RouteMap } from "@/components/maps/route-map";
import { Icon } from "@/components/ui/icon";
import { CardHeader, Pill, Stat } from "@/components/ui/primitives";
import {
  getActivityDetail,
  getAnalysisForActivity,
  getGearById,
  getPlannedRunByDate,
  getWhoopWorkoutForActivity,
} from "@/lib/supabase/queries";
import type { WorkoutType } from "@/lib/types";
import { fetchActivityStreams } from "@/lib/strava/sync";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { formatFullDate } from "@/lib/utils/dates";
import {
  formatDuration,
  formatFeet,
  formatMiles,
  speedToPacePerMile,
} from "@/lib/utils/units";

interface Props {
  params: { id: string };
}

function paceLabelFromSpeed(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const secPerMile = 1609.344 / ms;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildXLabels(durationS: number, count = 5): string[] {
  if (!durationS || durationS <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = (durationS * i) / (count - 1);
    if (i === 0) out.push("0");
    else {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      out.push(`${m}:${String(s).padStart(2, "0")}`);
    }
  }
  return out;
}

function activityKindLabel(planned: WorkoutType | undefined, name: string, sportType: string | null): string {
  if (planned === "long") return "Long";
  if (planned === "interval" || planned === "tempo" || planned === "workout") return "Workout";
  if (planned === "recovery") return "Recovery";
  if (planned === "race") return "Race";
  if (planned === "easy") return "Easy";
  const n = name.toLowerCase();
  if (n.includes("threshold") || n.includes("vo")) return "Workout";
  if (n.includes("long")) return "Long";
  if (n.includes("recovery") || n.includes("shake")) return "Recovery";
  if (n.includes("fartlek")) return "Fartlek";
  return sportType === "TrailRun" ? "Trail" : "Easy";
}

export default async function ActivityDetailPage({ params }: Props) {
  let detail = await getActivityDetail(Number(params.id));
  if (!detail) notFound();

  // Lazy-fetch streams the first time this activity is opened.
  const admin = createServiceRoleSupabase();
  const { data: cached } = await admin
    .from("activity_streams")
    .select("activity_id")
    .eq("activity_id", detail.activity.id)
    .maybeSingle();
  if (!cached) {
    try {
      await fetchActivityStreams(detail.activity.athlete_id, detail.activity.id);
      const refreshed = await getActivityDetail(Number(params.id));
      if (refreshed) detail = refreshed;
    } catch (e) {
      console.error("stream fetch failed for", detail.activity.id, e);
    }
  }

  const [analysis, gear, planned, whoop] = await Promise.all([
    getAnalysisForActivity(detail.activity.id),
    detail.activity.gear_id ? getGearById(detail.activity.gear_id) : Promise.resolve(null),
    getPlannedRunByDate(detail.activity.start_date_local.slice(0, 10)),
    getWhoopWorkoutForActivity(detail.activity.id),
  ]);

  // If we have WHOOP zones, replace the synthetic zone shape with real data.
  const hrZones = whoop && whoop.total_min > 0
    ? [
        { zone: "Z1" as const, label: "Recover", bpm_range: "<60%", minutes: whoop.zones_min[0], pct: Math.round((whoop.zones_min[0] / whoop.total_min) * 100) },
        { zone: "Z2" as const, label: "Aerobic", bpm_range: "60–70%", minutes: whoop.zones_min[1], pct: Math.round((whoop.zones_min[1] / whoop.total_min) * 100) },
        { zone: "Z3" as const, label: "Tempo",   bpm_range: "70–80%", minutes: whoop.zones_min[2], pct: Math.round((whoop.zones_min[2] / whoop.total_min) * 100) },
        { zone: "Z4" as const, label: "Thresh",  bpm_range: "80–90%", minutes: whoop.zones_min[3], pct: Math.round((whoop.zones_min[3] / whoop.total_min) * 100) },
        { zone: "Z5" as const, label: "VO₂",     bpm_range: "90+%",   minutes: whoop.zones_min[4], pct: Math.round((whoop.zones_min[4] / whoop.total_min) * 100) },
      ]
    : detail.zones;
  const { activity } = detail;

  const kindLabel = activityKindLabel(planned?.workout_type, activity.name, activity.sport_type);
  const metaLine = [
    formatFullDate(activity.start_date_local.slice(0, 10)),
    activity.start_date_local.slice(11, 16),
    gear?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  const xLabels = buildXLabels(activity.elapsed_time_s, 5);
  const fastestSplit = detail.splits.length
    ? detail.splits.reduce((best, s) =>
        !best || parseFloat(s.pace.replace(":", ".")) < parseFloat(best.pace.replace(":", ".")) ? s : best
      , detail.splits[0])
    : null;
  const splitPaceSecs = detail.splits.map((s) => {
    const [m, sec] = s.pace.split(":").map(Number);
    return m * 60 + (sec || 0);
  });
  const minSplitSec = splitPaceSecs.length ? Math.min(...splitPaceSecs) : 0;
  const maxSplitSec = splitPaceSecs.length ? Math.max(...splitPaceSecs) : 0;

  return (
    <div className="content fadein">
      <div
        className="row gap-10"
        style={{
          marginBottom: 14,
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 11,
          color: "var(--text-3)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <Link href="/activities" style={{ color: "inherit", cursor: "pointer" }}>
          ← Activities
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text-2)" }}>
          {activity.start_date_local.slice(5, 10)} · {activity.name}
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
        <div className="row between" style={{ padding: "18px 24px", borderBottom: "1px solid var(--hairline)" }}>
          <div className="col gap-6">
            <div className="row gap-10 baseline">
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                {activity.name}
              </h1>
              <Pill kind={kindLabel === "Workout" || kindLabel === "Fartlek" ? "accent" : "muted"}>{kindLabel}</Pill>
            </div>
            <div className="muted num" style={{ fontSize: 12 }}>{metaLine}</div>
          </div>
          <div className="row gap-8">
            <button type="button" className="btn">
              <Icon name="sync" size={12} />
              Re-sync
            </button>
            <button type="button" className="btn">
              <Icon name="more" size={12} />
            </button>
          </div>
        </div>

        <div className="row" style={{ alignItems: "stretch" }}>
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18, minWidth: 280, borderRight: "1px solid var(--hairline)" }}>
            <div className="col gap-4">
              <div className="stat-label" style={{ marginBottom: 0 }}>Distance</div>
              <div className="row baseline gap-4">
                <span className="stat-num" style={{ fontSize: 64 }}>{formatMiles(activity.distance_m)}</span>
                <span className="stat-unit" style={{ fontSize: 14 }}>mi</span>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <Stat label="Duration" value={formatDuration(activity.moving_time_s)} />
              <Stat label="Avg Pace" value={speedToPacePerMile(activity.average_speed_ms)} unit="/mi" />
              <Stat label="Avg HR" value={activity.average_heartrate ?? "—"} unit="bpm" />
              <Stat label="Max HR" value={activity.max_heartrate ?? "—"} unit="bpm" />
              <Stat label="Elev" value={formatFeet(activity.total_elevation_gain_m)} unit="ft" />
              <Stat label="Cadence" value={activity.average_cadence ?? "—"} unit="spm" />
            </div>
          </div>
          <div style={{ flex: 1, padding: 14 }}>
            {detail.route_points.length > 0 ? (
              <RouteMap
                points={detail.route_points}
                height={300}
                titleLabel={`${activity.name} · ${formatMiles(activity.distance_m)}mi`}
                metaLabel={metaLine}
              />
            ) : (
              <div
                className="muted"
                style={{
                  height: 300,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  border: "1px dashed var(--hairline)",
                  borderRadius: 10,
                  textAlign: "center",
                  padding: 20,
                }}
              >
                {activity.trainer
                  ? "Indoor run — no GPS"
                  : activity.manual
                    ? "Manually logged — no GPS"
                    : "No GPS data on this activity"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr 1fr", marginBottom: 14 }}>
        <div className="card">
          <CardHeader title="HR Zones · This run" />
          <div style={{ marginBottom: 14 }}>
            <ZoneBar zones={hrZones} />
          </div>
          <table className="tbl" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Zone</th>
                <th>BPM</th>
                <th className="num">Time</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {hrZones.map((z, i) => (
                <tr key={z.zone}>
                  <td>
                    <span style={{ color: `var(--zone-${i + 1})`, marginRight: 6 }}>■</span>
                    {z.zone} <span className="muted">{z.label}</span>
                  </td>
                  <td className="num muted">{z.bpm_range}</td>
                  <td className="num">{z.minutes}:00</td>
                  <td className="num">{z.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <CardHeader title="Splits · per mile" action={fastestSplit ? `Fastest mi · ${fastestSplit.pace}` : ""} />
          {detail.splits.length === 0 ? (
            <div className="muted" style={{ padding: 12, fontSize: 12 }}>
              No splits — streams not yet fetched for this activity.
            </div>
          ) : (
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Mi</th>
                  <th className="num">Pace</th>
                  <th></th>
                  <th className="num">HR</th>
                  <th className="num">Elev</th>
                </tr>
              </thead>
              <tbody>
                {detail.splits.map((s, i) => {
                  const totalSec = splitPaceSecs[i];
                  const range = maxSplitSec - minSplitSec || 1;
                  const pct = Math.max(0.08, 1 - (totalSec - minSplitSec) / range);
                  const isFastest = fastestSplit && s.mi === fastestSplit.mi;
                  return (
                    <tr key={s.mi}>
                      <td className="num">{s.mi}</td>
                      <td
                        className="num"
                        style={{
                          color: isFastest ? "var(--accent)" : "var(--text-1)",
                          fontWeight: isFastest ? 500 : 400,
                        }}
                      >
                        {s.pace}
                      </td>
                      <td style={{ width: "40%" }}>
                        <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 2 }}>
                          <div
                            style={{
                              width: `${pct * 100}%`,
                              height: "100%",
                              background: isFastest ? "var(--accent)" : "var(--text-3)",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </td>
                      <td className="num">{s.hr || "—"}</td>
                      <td className="num muted">
                        {s.elev_ft > 0 ? `+${s.elev_ft}` : s.elev_ft}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {analysis && (
          <div className="card" style={{ background: "var(--surface-2)" }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="row gap-6 baseline">
                <Icon name="sparkle" size={12} />
                <span className="card-title" style={{ color: "var(--accent)" }}>AI Coach · Analysis</span>
              </div>
              <span className="card-action">Regenerate</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.5, fontWeight: 500, marginBottom: 12 }}>
              {analysis.summary}
            </div>
            <div className="col gap-10" style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 }}>
              <p style={{ margin: 0 }}>{analysis.feedback_jsonb.pacing}</p>
              <p style={{ margin: 0 }}>{analysis.feedback_jsonb.effort}</p>
              <p style={{ margin: 0 }}>{analysis.feedback_jsonb.plan_adherence}</p>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
              <div className="col gap-6">
                {analysis.feedback_jsonb.flags.map((f, i) => (
                  <div key={i} className="row gap-8" style={{ fontSize: 12, alignItems: "flex-start" }}>
                    <span
                      style={{
                        color: f.kind === "positive" ? "var(--accent)" : "var(--amber)",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: 10,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        width: 56,
                        flexShrink: 0,
                        paddingTop: 2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.kind === "positive" ? "+ Good" : "! Note"}
                    </span>
                    <span style={{ color: "var(--text-1)", flex: 1, lineHeight: 1.4 }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="card-title">Heart Rate · Full run</div>
            <div className="row gap-10" style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, color: "var(--text-2)" }}>
              <span>avg <span style={{ color: "var(--text-1)" }}>{activity.average_heartrate ?? "—"}</span></span>
              <span>max <span style={{ color: "var(--text-1)" }}>{activity.max_heartrate ?? "—"}</span></span>
            </div>
          </div>
          {detail.hr_curve.length > 0 ? (
            <LineChart
              data={detail.hr_curve}
              width={500}
              height={180}
              padL={36}
              stroke="var(--red)"
              minY={Math.min(...detail.hr_curve) - 5}
              maxY={Math.max(...detail.hr_curve) + 5}
              yTicks={5}
              xLabels={xLabels}
            />
          ) : (
            <div className="muted" style={{ padding: 24, textAlign: "center", fontSize: 12 }}>No HR stream.</div>
          )}
        </div>
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="card-title">Pace · Full run</div>
            <div className="row gap-10" style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, color: "var(--text-2)" }}>
              <span>avg <span style={{ color: "var(--text-1)" }}>{paceLabelFromSpeed(activity.average_speed_ms ?? 0)}</span></span>
              <span>fastest <span style={{ color: "var(--accent)" }}>{paceLabelFromSpeed(activity.max_speed_ms ?? 0)}</span></span>
            </div>
          </div>
          {detail.pace_curve.length > 0 ? (
            <LineChart
              data={detail.pace_curve}
              width={500}
              height={180}
              padL={36}
              stroke="var(--accent)"
              invertY
              minY={Math.min(...detail.pace_curve.filter((p) => p > 0)) - 0.5}
              maxY={Math.max(...detail.pace_curve) + 0.5}
              yTicks={4}
              xLabels={xLabels}
            />
          ) : (
            <div className="muted" style={{ padding: 24, textAlign: "center", fontSize: 12 }}>No pace stream.</div>
          )}
        </div>
      </div>
    </div>
  );
}
