import { LineChart } from "@/components/charts/line-chart";
import { MileageBars } from "@/components/charts/mileage-bars";
import { ZoneBar } from "@/components/charts/zone-bar";
import { StatsRangeSwitcher } from "@/app/(app)/stats/range-switcher";
import { CardHeader, Stat } from "@/components/ui/primitives";
import {
  getActivityTotals,
  getAllActivities,
  getMonthlyStats,
  getPaceTrend12w,
  getWeekHRZones,
} from "@/lib/supabase/queries";
import { formatDuration, metersToMiles, milesToMeters } from "@/lib/utils/units";

const M_PER_MILE = 1609.344;
const M_PER_FT = 0.3048;

function paceFromDecimal(min: number): string {
  if (!min || min <= 0) return "—";
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function StatsPage() {
  const [monthly, paceTrend, zones, totals, activities] = await Promise.all([
    getMonthlyStats(),
    getPaceTrend12w(),
    getWeekHRZones(),
    getActivityTotals(),
    getAllActivities(),
  ]);

  const monthlyBars = monthly.map((m, i) => ({
    week_number: i + 1,
    label: m.label,
    start_date: "",
    planned_m: milesToMeters(m.miles),
    actual_m: milesToMeters(m.miles),
  }));

  // Pace trend stats
  const paceVals = paceTrend.filter((p) => p > 0);
  const paceCurrent = paceVals[paceVals.length - 1] ?? 0;
  const paceFirst = paceVals[0] ?? 0;
  const paceDeltaSec = paceFirst > 0 && paceCurrent > 0 ? Math.round((paceFirst - paceCurrent) * 60) : null;

  // All-time totals (since first activity)
  const sortedByDate = [...activities].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const firstYear = sortedByDate[0] ? new Date(sortedByDate[0].start_date).getUTCFullYear() : null;
  const allTimeMi = Math.round(metersToMiles(activities.reduce((a, b) => a + Number(b.distance_m ?? 0), 0)));
  const allTimeDur = activities.reduce((a, b) => a + Number(b.moving_time_s ?? 0), 0);
  const headerLine = `All-time · ${allTimeMi.toLocaleString()} mi · ${formatDuration(allTimeDur)}${firstYear ? ` · since ${firstYear}` : ""}`;

  // Zones total (use minutes as-is from getWeekHRZones, already real)
  const zonesTotalMin = zones.reduce((a, z) => a + z.minutes, 0);
  const zonesTotalH = Math.floor(zonesTotalMin / 60);
  const zonesTotalRem = zonesTotalMin % 60;

  // Elevation YTD
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString();
  const ytdActs = activities.filter((a) => a.start_date >= yearStart);
  const totalElevFt = Math.round(ytdActs.reduce((a, b) => a + Number(b.total_elevation_gain_m ?? 0), 0) / M_PER_FT);
  const perRunFt = ytdActs.length ? Math.round(totalElevFt / ytdActs.length) : 0;
  const biggestDayFt = ytdActs.reduce((max, a) => Math.max(max, Math.round(Number(a.total_elevation_gain_m ?? 0) / M_PER_FT)), 0);
  const everestFt = 29032;
  const everestX = totalElevFt > 0 ? +(totalElevFt / everestFt).toFixed(2) : 0;
  const flatRunsPct = ytdActs.length ? Math.round((ytdActs.filter((a) => (Number(a.total_elevation_gain_m ?? 0) / M_PER_FT) < 50).length / ytdActs.length) * 100) : 0;

  // Longest run
  const longest = activities.reduce<typeof activities[number] | null>(
    (best, a) => (!best || Number(a.distance_m ?? 0) > Number(best.distance_m ?? 0)) ? a : best,
    null
  );

  // Best 10K effort: closest run >= 10K with best avg pace
  const tenK = M_PER_MILE * 6.214;
  const tenKCandidates = activities.filter((a) => Number(a.distance_m ?? 0) >= tenK && a.average_speed_ms);
  const bestTenK = tenKCandidates.reduce<typeof activities[number] | null>(
    (best, a) => (!best || (a.average_speed_ms ?? 0) > (best.average_speed_ms ?? 0)) ? a : best,
    null
  );
  const bestTenKTime = bestTenK?.average_speed_ms ? Math.round(tenK / bestTenK.average_speed_ms) : null;

  // YTD vs last year
  const lastYear = new Date().getUTCFullYear() - 1;
  const lastYearStart = new Date(Date.UTC(lastYear, 0, 1)).toISOString();
  const lastYearEnd = new Date(Date.UTC(lastYear + 1, 0, 1)).toISOString();
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(Date.UTC(today.getUTCFullYear(), 0, 1)).getTime()) / 86400_000);
  const lastYTDCutoff = new Date(Date.UTC(lastYear, 0, 1));
  lastYTDCutoff.setUTCDate(lastYTDCutoff.getUTCDate() + dayOfYear);
  const lastYearMi = Math.round(
    metersToMiles(
      activities
        .filter((a) => a.start_date >= lastYearStart && a.start_date < lastYTDCutoff.toISOString())
        .reduce((a, b) => a + Number(b.distance_m ?? 0), 0)
    )
  );
  const ytdMi = Math.round(metersToMiles(totals.distance_ytd_m));
  const ytdDeltaPct = lastYearMi > 0 ? Math.round(((ytdMi - lastYearMi) / lastYearMi) * 100) : null;

  // x-labels for trend chart from monthly stats
  const trendXLabels = paceVals.length === 12
    ? Array.from({ length: 12 }, (_, i) => {
        if (i === 0 || i === 4 || i === 8) {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - (11 - i) * 7);
          return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
        }
        return i === 11 ? "Now" : "";
      })
    : [];

  return (
    <div className="content fadein">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="col gap-4">
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>Stats</h1>
          <div className="muted num" style={{ fontSize: 12 }}>{headerLine}</div>
        </div>
        <StatsRangeSwitcher />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 14 }}>
        <div className="card">
          <CardHeader title="Monthly Mileage · Last 6 months" />
          <MileageBars weeks={monthlyBars} width={820} height={180} currentIndex={5} />
        </div>
        <div className="card">
          <CardHeader title="Pace Trend · 12w Easy Pace" />
          <Stat
            label="Current"
            value={paceFromDecimal(paceCurrent)}
            unit="/mi"
            size="lg"
            delta={paceDeltaSec != null ? `${paceDeltaSec >= 0 ? "−" : "+"}${Math.abs(paceDeltaSec)}s` : undefined}
            deltaKind={paceDeltaSec != null && paceDeltaSec >= 0 ? "up" : "down"}
          />
          <div style={{ marginTop: 14 }}>
            <LineChart
              data={paceTrend.map((p) => p || 0)}
              width={380}
              height={140}
              padL={32}
              invertY
              unit=":00"
              xLabels={trendXLabels}
            />
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 14 }}>
        <div className="card">
          <CardHeader title="Resting HR · 12w" />
          <Stat label="Current" value="—" unit="bpm" size="lg" />
          <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>
            Connect Whoop to populate.
          </div>
        </div>
        <div className="card">
          <CardHeader title="Time in HR Zones · 7d" action={`${zonesTotalH}:${String(zonesTotalRem).padStart(2, "0")}:00`} />
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <ZoneBar zones={zones} />
          </div>
          <div className="col gap-6" style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 11 }}>
            {zones.map((z, i) => (
              <div key={z.zone} className="row between">
                <span>
                  <span style={{ color: `var(--zone-${i + 1})` }}>■</span> {z.zone}{" "}
                  <span className="muted">{z.label}</span>
                </span>
                <span>{z.minutes}m</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <CardHeader title="Elevation · YTD" />
          <Stat label="Total climb" value={totalElevFt.toLocaleString()} unit="ft" size="lg" />
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
            <Stat label="Per run avg" value={String(perRunFt)} unit="ft" />
            <Stat label="Biggest day" value={biggestDayFt.toLocaleString()} unit="ft" />
            <Stat label="vs Mt Everest" value={everestX > 0 ? `${everestX}×` : "—"} />
            <Stat label="Flat runs" value={`${flatRunsPct}%`} />
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
        <div className="card">
          <Stat
            label="Year to Date"
            value={ytdMi.toLocaleString()}
            unit="mi"
            size="lg"
            delta={ytdDeltaPct != null ? `${ytdDeltaPct >= 0 ? "+" : ""}${ytdDeltaPct}% vs last yr` : undefined}
            deltaKind={ytdDeltaPct != null && ytdDeltaPct >= 0 ? "up" : "down"}
          />
        </div>
        <div className="card">
          <Stat
            label="Longest run"
            value={longest ? metersToMiles(Number(longest.distance_m ?? 0)).toFixed(1) : "—"}
            unit="mi"
            size="lg"
            delta={longest ? longest.start_date_local.slice(0, 10) : undefined}
          />
        </div>
        <div className="card">
          <Stat
            label="Best 10K effort"
            value={bestTenKTime ? formatDuration(bestTenKTime) : "—"}
            size="lg"
            delta={bestTenK ? bestTenK.start_date_local.slice(0, 10) : undefined}
          />
        </div>
        <div className="card">
          <Stat label="VDOT estimate" value="—" size="lg" />
        </div>
      </div>
    </div>
  );
}
