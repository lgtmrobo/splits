import Link from "next/link";
import { CardHeader } from "@/components/ui/primitives";
import {
  formatDuration,
  formatMilesCompact,
  metersToMiles,
} from "@/lib/utils/units";
import type { Activity, Race } from "@/lib/types";

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

function fmtMd(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function pacePerMile(distance_m: number, duration_s: number): string {
  const sec = duration_s / metersToMiles(distance_m);
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row between">
      <span className="stat-label" style={{ marginBottom: 0 }}>
        {label}
      </span>
      <span className="num">{children}</span>
    </div>
  );
}

// Replaces "Block Summary" once a block is over: what the block produced
// rather than what's left in it.
export function BlockRecap({
  race,
  raceActivity,
  blockRuns,
  totalWeeks,
  plannedMi,
  actualMi,
  adherencePct,
}: {
  race: Race | null;
  raceActivity: Activity | null;
  blockRuns: Activity[];
  totalWeeks: number;
  plannedMi: number;
  actualMi: number;
  adherencePct: number;
}) {
  const finishS = race?.result_time_s ?? raceActivity?.moving_time_s ?? null;
  const goalDeltaS =
    finishS != null && race?.goal_time_s != null
      ? finishS - race.goal_time_s
      : null;

  const trainingRuns = blockRuns.filter((a) => a.id !== raceActivity?.id);
  const longest = trainingRuns.reduce<Activity | null>(
    (best, a) => (!best || a.distance_m > best.distance_m ? a : best),
    null,
  );

  return (
    <div className="card">
      <CardHeader title="Block Recap" />
      <div className="col gap-14">
        {race && finishS != null && (
          <>
            <div className="col gap-4">
              <div className="stat-label" style={{ marginBottom: 0 }}>
                Race result
              </div>
              <div className="row baseline gap-10">
                <span
                  className="stat-num"
                  style={{ fontSize: 26, color: "var(--text-1)" }}
                >
                  {formatDuration(finishS)}
                </span>
                <span className="muted num" style={{ fontSize: 12 }}>
                  {pacePerMile(race.distance_m, finishS)}/mi
                </span>
              </div>
              {goalDeltaS != null && (
                <span
                  className="num"
                  style={{
                    fontSize: 12,
                    color: goalDeltaS <= 0 ? "var(--accent)" : "var(--text-2)",
                  }}
                >
                  {goalDeltaS <= 0 ? "−" : "+"}
                  {formatDuration(Math.abs(goalDeltaS))} vs{" "}
                  {formatDuration(race.goal_time_s)} goal
                </span>
              )}
              {raceActivity && (
                <Link
                  href={`/activities/${raceActivity.id}`}
                  className="num"
                  style={{ fontSize: 12, color: "var(--accent)" }}
                >
                  View race activity →
                </Link>
              )}
            </div>
            <div className="hr" />
          </>
        )}
        <div className="col gap-6">
          <Row label="Miles logged">
            {formatMilesCompact(actualMi)} / {formatMilesCompact(plannedMi)}
          </Row>
          <Row label="Avg week">
            {formatMilesCompact(actualMi / Math.max(1, totalWeeks))} mi
          </Row>
          <Row label="Runs">{blockRuns.length}</Row>
          <Row label="Adherence">{adherencePct}%</Row>
          {longest && (
            <Row label="Longest run">
              <Link
                href={`/activities/${longest.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {formatMilesCompact(metersToMiles(longest.distance_m))} mi ·{" "}
                {fmtMd(longest.start_date_local)}
              </Link>
            </Row>
          )}
        </div>
      </div>
    </div>
  );
}
