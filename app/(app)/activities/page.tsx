import Link from "next/link";
import { RouteThumb } from "@/components/maps/route-thumb";
import { Icon } from "@/components/ui/icon";
import { Pill, Stat } from "@/components/ui/primitives";
import { ActivityTypeFilter } from "@/app/(app)/activities/filter";
import { getActivityTotals, getAllActivities, getAllGear, getPlannedRunsBetween } from "@/lib/supabase/queries";
import type { WorkoutType } from "@/lib/types";
import {
  formatDuration,
  formatFeet,
  formatMiles,
  metersToMiles,
  speedToPacePerMile,
} from "@/lib/utils/units";

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

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const [allActivities, totals, gear] = await Promise.all([
    getAllActivities(),
    getActivityTotals(),
    getAllGear(),
  ]);
  const gearById = new Map(gear.map((g) => [g.id, g]));
  const dates = allActivities.map((a) => a.start_date_local.slice(0, 10)).sort();
  const minDate = dates[0] ?? "1970-01-01";
  const maxDate = dates[dates.length - 1] ?? "1970-01-01";
  const planned = allActivities.length ? await getPlannedRunsBetween(minDate, maxDate) : [];
  const typeByDate = new Map<string, WorkoutType>(planned.map((p) => [p.scheduled_date, p.workout_type]));

  const filter = searchParams.type ?? "all";
  const activities = allActivities.filter((a) => {
    if (filter === "all") return true;
    const label = labelForActivity(typeByDate.get(a.start_date_local.slice(0, 10)), a.name).toLowerCase();
    return label === filter;
  });

  return (
    <div className="content fadein">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="col gap-4">
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Activities
          </h1>
          <div className="muted num" style={{ fontSize: 12 }}>
            {totals.count} runs · {Math.round(metersToMiles(totals.distance_m))} mi ·{" "}
            {formatDuration(totals.duration_s)} total
          </div>
        </div>
        <div className="row gap-10">
          <ActivityTypeFilter />
          <button type="button" className="btn">
            <Icon name="filter" size={12} />
            Filter
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(6, 1fr)", marginBottom: 14 }}
      >
        <div className="card compact">
          <Stat label="7 days" value={metersToMiles(totals.distance_7d_m).toFixed(1)} unit="mi" />
        </div>
        <div className="card compact">
          <Stat
            label="28 days"
            value={metersToMiles(totals.distance_28d_m).toFixed(1)}
            unit="mi"
          />
        </div>
        <div className="card compact">
          <Stat
            label="YTD"
            value={Math.round(metersToMiles(totals.distance_ytd_m))}
            unit="mi"
          />
        </div>
        <div className="card compact">
          <Stat
            label="Avg pace 28d"
            value={speedToPacePerMile(totals.avg_pace_28d_ms)}
            unit="/mi"
          />
        </div>
        <div className="card compact">
          <Stat label="Avg HR 28d" value={totals.avg_hr_28d} unit="bpm" />
        </div>
        <div className="card compact">
          <Stat label="Elev 28d" value={formatFeet(totals.elev_28d_m)} unit="ft" />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th></th>
              <th>Date</th>
              <th>Activity</th>
              <th>Type</th>
              <th className="num">Dist</th>
              <th className="num">Pace</th>
              <th className="num">Time</th>
              <th className="num">HR</th>
              <th className="num">Elev</th>
              <th>Shoe</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a, i) => {
              const date = a.start_date_local.slice(0, 10);
              const label = labelForActivity(typeByDate.get(date), a.name);
              const shoe = a.gear_id ? gearById.get(a.gear_id)?.name ?? null : null;
              return (
                <tr key={a.id} className="clickable">
                  <td style={{ width: 64 }}>
                    <Link href={`/activities/${a.id}`}>
                      <RouteThumb polyline={a.summary_polyline} seed={i * 7 + 3} size={44} />
                    </Link>
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--text-3)", fontSize: 11 }}
                  >
                    {a.start_date_local.slice(5, 10)}
                    <br />
                    <span style={{ fontSize: 10, color: "var(--text-4)" }}>
                      {a.start_date_local.slice(11, 16)}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/activities/${a.id}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      <div style={{ fontSize: 13 }}>{a.name}</div>
                    </Link>
                  </td>
                  <td>
                    <Pill kind={label === "Workout" || label === "Fartlek" ? "accent" : label === "Long" ? "default" : "muted"}>
                      {label}
                    </Pill>
                  </td>
                  <td className="num">{formatMiles(a.distance_m)}</td>
                  <td className="num">{speedToPacePerMile(a.average_speed_ms)}</td>
                  <td className="num muted">{formatDuration(a.moving_time_s)}</td>
                  <td className="num">{a.average_heartrate ?? "—"}</td>
                  <td className="num muted">{formatFeet(a.total_elevation_gain_m)}</td>
                  <td style={{ fontSize: 11, color: "var(--text-2)" }}>{shoe ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
