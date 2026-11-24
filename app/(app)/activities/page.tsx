import Link from "next/link";
import { RouteThumb } from "@/components/maps/route-thumb";
import { Icon } from "@/components/ui/icon";
import { Stat } from "@/components/ui/primitives";
import { TypePill } from "@/components/ui/type-pill";
import { ShoeLabel } from "@/components/gear/shoe-label";
import { FluidTable, FluidTr } from "@/components/fluid/fluid-table";
import { formatSportDistance, formatSportSpeed, sportOf } from "@/lib/activities/sports";
import { gearShares } from "@/lib/gear/segments";
import { ActivityTypeFilter } from "@/app/(app)/activities/filter";
import { getActivityTotals, getAllActivities, getAllGear, getPlannedRunsBetween } from "@/lib/supabase/queries";
import type { WorkoutType } from "@/lib/types";
import {
  formatDuration,
  formatFeet,
  metersToMiles,
  speedToPacePerMile,
} from "@/lib/utils/units";

function labelForActivity(
  planned: WorkoutType | undefined,
  name: string,
  type: string,
): string {
  // A triathlete's swims and rides are labeled by sport, never by run plan.
  const sport = sportOf(type);
  if (sport === "swim") return "Swim";
  if (sport === "bike") return "Ride";
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
  searchParams: Promise<{ type?: string }>;
}) {
  const [allActivities, totals, gear] = await Promise.all([
    // Swims and rides too, for triathletes; runs-only for everyone else.
    getAllActivities({ allSports: true }),
    getActivityTotals(),
    getAllGear(),
  ]);
  const gearById = new Map(gear.map((g) => [g.id, g]));
  const dates = allActivities.map((a) => a.start_date_local.slice(0, 10)).sort();
  const minDate = dates[0] ?? "1970-01-01";
  const maxDate = dates[dates.length - 1] ?? "1970-01-01";
  const planned = allActivities.length ? await getPlannedRunsBetween(minDate, maxDate) : [];
  const typeByDate = new Map<string, WorkoutType>(planned.map((p) => [p.scheduled_date, p.workout_type]));

  const filter = (await searchParams).type ?? "all";
  const activities = allActivities.filter((a) => {
    if (filter === "all") return true;
    const label = labelForActivity(
      typeByDate.get(a.start_date_local.slice(0, 10)),
      a.name,
      a.type,
    ).toLowerCase();
    return label === filter;
  });

  return (
    <div className="content fadein">
      <div className="row between wrap gap-10" style={{ marginBottom: 14 }}>
        <div className="col gap-4">
          <h1 className="page-title">
            Activities
          </h1>
          <div className="muted num" style={{ fontSize: 12 }}>
            {totals.count} runs · {Math.round(metersToMiles(totals.distance_m))} mi ·{" "}
            {formatDuration(totals.duration_s)} total
          </div>
        </div>
        <div className="row gap-10">
          <ActivityTypeFilter />
          <button type="button" className="btn m-hide">
            <Icon name="filter" size={12} />
            Filter
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div
        className="grid m-2col"
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
        <FluidTable>
          <thead>
            <tr>
              <th className="m-hide"></th>
              <th>Date</th>
              <th>Activity</th>
              <th className="m-hide">Type</th>
              <th className="num">Dist</th>
              <th className="num">Pace</th>
              <th className="num m-hide">Time</th>
              <th className="num m-hide">HR</th>
              <th className="num m-hide">Elev</th>
              <th className="m-hide">Shoe</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a, i) => {
              const date = a.start_date_local.slice(0, 10);
              const label = labelForActivity(typeByDate.get(date), a.name, a.type);
              const sport = sportOf(a.type) ?? "run";
              const dist = formatSportDistance(sport, a.distance_m);
              const speed = formatSportSpeed(sport, a.average_speed_ms);
              return (
                <FluidTr key={a.id} index={i} href={`/activities/${a.id}`}>
                  <td className="m-hide" style={{ width: 64 }}>
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
                  <td className="cell-wrap">
                    <Link
                      href={`/activities/${a.id}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      <div style={{ fontSize: 13 }}>{a.name}</div>
                    </Link>
                  </td>
                  <td className="m-hide">
                    <TypePill type={label} />
                  </td>
                  <td className="num">
                    {dist.value}
                    {sport === "swim" && <span className="muted"> yd</span>}
                  </td>
                  <td className="num">
                    {speed.value}
                    {sport !== "run" && <span className="muted"> {speed.unit}</span>}
                  </td>
                  <td className="num muted m-hide">{formatDuration(a.moving_time_s)}</td>
                  <td className="num m-hide">{a.average_heartrate ?? "—"}</td>
                  <td className="num muted m-hide">{formatFeet(a.total_elevation_gain_m)}</td>
                  <td className="m-hide" style={{ fontSize: 11, color: "var(--text-2)", maxWidth: 220 }}>
                    <ShoeLabel shares={gearShares(a)} gearById={gearById} />
                  </td>
                </FluidTr>
              );
            })}
          </tbody>
        </FluidTable>
      </div>
    </div>
  );
}
