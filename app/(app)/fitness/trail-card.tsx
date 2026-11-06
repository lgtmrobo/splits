import Link from "next/link";
import { ValueBars } from "@/components/charts/value-bars";
import { CardHeader, Stat } from "@/components/ui/primitives";
import type { WeeklyTrail } from "@/lib/fitness/trail";
import type { FitnessActivity } from "@/lib/fitness/types";
import { formatDurationShort, M_PER_FT, M_PER_MILE } from "@/lib/utils/units";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Trailing window for the headline averages (excludes the current week). */
const AVG_WEEKS = 4;

function weekLabel(iso: string): string {
  return `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;
}

export function TrailCard({
  weeks,
  longest,
}: {
  weeks: WeeklyTrail[];
  longest: FitnessActivity | null;
}) {
  const labels = weeks.map((w) => weekLabel(w.weekStart));
  const vertFt = weeks.map((w) => w.vertM / M_PER_FT);
  const hours = weeks.map((w) => w.timeS / 3600);

  const complete = weeks.slice(0, -1).slice(-AVG_WEEKS);
  const sum = (f: (w: WeeklyTrail) => number) => complete.reduce((a, w) => a + f(w), 0);
  const avgVertFt = complete.length ? sum((w) => w.vertM) / M_PER_FT / complete.length : 0;
  const avgTimeS = complete.length ? sum((w) => w.timeS) / complete.length : 0;
  const miles = sum((w) => w.distanceM) / M_PER_MILE;
  const ftPerMile = miles > 0 ? sum((w) => w.vertM) / M_PER_FT / miles : 0;
  const runs = sum((w) => w.runs);
  const trailPct = runs > 0 ? Math.round((sum((w) => w.trailRuns) / runs) * 100) : 0;

  return (
    <div className="card">
      <CardHeader title={`Trail Volume · ${weeks.length}w`} action="Vertical and time on feet, by week" />
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 14 }}>
        <Stat label={`Vert / wk · ${AVG_WEEKS}w avg`} value={Math.round(avgVertFt).toLocaleString()} unit="ft" />
        <Stat label={`Time on feet / wk`} value={formatDurationShort(avgTimeS)} />
        <Stat label="Climb density" value={String(Math.round(ftPerMile))} unit="ft/mi" />
        <Stat label="Trail share" value={`${trailPct}%`} />
        <Stat
          label="Longest outing"
          value={longest ? formatDurationShort(Number(longest.elapsed_time_s ?? longest.moving_time_s ?? 0)) : "—"}
          delta={
            longest ? (
              <Link href={`/activities/${longest.id}`} style={{ color: "inherit" }}>
                {longest.start_date_local.slice(0, 10)}
              </Link>
            ) : undefined
          }
        />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div className="stat-label" style={{ marginBottom: 6 }}>Vertical (ft)</div>
          <ValueBars
            values={vertFt}
            labels={labels}
            color="var(--amber)"
            format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
          />
        </div>
        <div>
          <div className="stat-label" style={{ marginBottom: 6 }}>Time on feet (h)</div>
          <ValueBars values={hours} labels={labels} color="var(--blue)" format={(v) => v.toFixed(1)} />
        </div>
      </div>
    </div>
  );
}
