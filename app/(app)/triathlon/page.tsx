import { notFound } from "next/navigation";
import { SportHoursBars } from "@/components/charts/sport-hours-bars";
import { CardHeader, Stat } from "@/components/ui/primitives";
import {
  formatSportDistance,
  formatSportSpeed,
  SPORT_COLORS,
  type Sport,
} from "@/lib/activities/sports";
import { RACE_TYPES, TRI_LEGS } from "@/lib/races/types";
import { getTriathlonView } from "@/lib/supabase/queries";
import type { SportSummary } from "@/lib/tri/summary";
import { formatDuration } from "@/lib/utils/units";
import { dayDiff, todayLocalISO } from "@/lib/utils/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(iso: string): string {
  return `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}, ${iso.slice(0, 4)}`;
}

const SPORT_LABEL: Record<Sport, string> = { swim: "Swim", bike: "Bike", run: "Run" };

export default async function TriathlonPage() {
  const view = await getTriathlonView();
  // Only athletes with an Ironman / 70.3 on their Races page have this page.
  if (!view) notFound();

  const { race, summary } = view;
  const raceType = race.race_type as "ironman_70_3" | "ironman";
  const legs = TRI_LEGS[raceType];
  const legM: Record<Sport, number> = { swim: legs.swim_m, bike: legs.bike_m, run: legs.run_m };
  const daysOut = dayDiff(todayLocalISO(), race.race_date);
  const n = summary.recentWeeks;
  const recentTotal = (["swim", "bike", "run"] as Sport[]).reduce(
    (t, s) => t + summary.recent[s].time_s,
    0,
  );

  return (
    <div className="content fadein">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between wrap gap-14" style={{ alignItems: "flex-end" }}>
          <div className="col gap-4">
            <div className="card-title accent">
              {RACE_TYPES.find((t) => t.value === raceType)?.label}
              {daysOut >= 0 ? ` · ${Math.ceil(daysOut / 7)} weeks out` : " · completed"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{race.name}</div>
            <div className="muted num" style={{ fontSize: 12 }}>
              {fmtDate(race.race_date)}
              {race.location ? ` · ${race.location}` : ""}
            </div>
          </div>
          <div className="grid m-2col" style={{ gridTemplateColumns: "repeat(4, auto)", gap: 24 }}>
            {(["swim", "bike", "run"] as Sport[]).map((s) => {
              const d = formatSportDistance(s, legM[s]);
              return <Stat key={s} label={SPORT_LABEL[s]} value={d.value} unit={d.unit} />;
            })}
            <Stat label="Goal" value={race.goal_time_s ? formatDuration(race.goal_time_s) : "—"} />
          </div>
        </div>
      </div>

      <div className="card-title" style={{ marginBottom: 8 }}>
        Last {n} weeks
      </div>
      <div className="grid m-stack" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 14 }}>
        {(["swim", "bike", "run"] as Sport[]).map((s) => (
          <SportCard key={s} sport={s} r={summary.recent[s]} weeks={n} legM={legM[s]} />
        ))}
      </div>

      <div className="grid m-stack" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", marginBottom: 14 }}>
        <div className="card">
          <CardHeader title="Weekly hours · 12 weeks" />
          <SportHoursBars weeks={summary.weeks} />
        </div>
        <div className="card col gap-14">
          <div>
            <CardHeader title={`Time split · last ${n} weeks`} />
            {recentTotal > 0 ? (
              <>
                <div className="row" style={{ height: 8, gap: 2, borderRadius: 4, overflow: "hidden" }}>
                  {(["swim", "bike", "run"] as Sport[]).map((s) =>
                    summary.recent[s].time_s > 0 ? (
                      <div
                        key={s}
                        style={{
                          flex: summary.recent[s].time_s,
                          alignSelf: "stretch",
                          background: SPORT_COLORS[s],
                        }}
                      />
                    ) : null,
                  )}
                </div>
                <div className="col gap-4" style={{ marginTop: 10, fontSize: 12 }}>
                  {(["swim", "bike", "run"] as Sport[]).map((s) => (
                    <div key={s} className="row between">
                      <span className="row gap-6" style={{ alignItems: "center", color: "var(--text-2)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: SPORT_COLORS[s] }} />
                        {SPORT_LABEL[s]}
                      </span>
                      <span className="num">
                        {Math.round((summary.recent[s].time_s / recentTotal) * 100)}% ·{" "}
                        {formatDuration(summary.recent[s].time_s)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                No swims, rides or runs in the last {n} weeks.
              </div>
            )}
          </div>
          <div className="hr" />
          <div>
            <Stat label={`Bricks · last ${n} weeks`} value={String(summary.bricks.count)} />
            <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
              A run within 30 minutes of finishing a ride
              {summary.bricks.last ? ` · last on ${fmtDate(summary.bricks.last)}` : ""}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SportCard({
  sport,
  r,
  weeks,
  legM,
}: {
  sport: Sport;
  r: SportSummary;
  weeks: number;
  legM: number;
}) {
  const perWeek = formatSportDistance(sport, r.distance_m / weeks);
  const speed = formatSportSpeed(sport, r.speed_ms);
  const longest = formatSportDistance(sport, r.longest_m);
  const leg = formatSportDistance(sport, legM);
  const pct = Math.min(1, r.leg_pct);
  return (
    <div className="card">
      <div className="row gap-6" style={{ alignItems: "center", marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: SPORT_COLORS[sport] }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>{SPORT_LABEL[sport]}</span>
        <span className="muted num" style={{ marginLeft: "auto", fontSize: 11 }}>
          {(r.sessions / weeks).toFixed(1)} / week
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Stat label="Per week" value={perWeek.value} unit={perWeek.unit} />
        <Stat label={sport === "bike" ? "Avg speed" : "Avg pace"} value={speed.value} unit={speed.unit} />
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="row between" style={{ fontSize: 11, marginBottom: 4 }}>
          <span className="stat-label" style={{ marginBottom: 0 }}>
            Longest vs race
          </span>
          <span className="num" style={{ color: "var(--text-2)" }}>
            {longest.value} / {leg.value} {leg.unit}
          </span>
        </div>
        <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct * 100}%`, background: SPORT_COLORS[sport] }} />
        </div>
      </div>
    </div>
  );
}
