import Link from "next/link";
import { CardHeader, Pill } from "@/components/ui/primitives";
import type { BestEffort, PeakRow } from "@/lib/fitness/best-efforts";
import { formatDuration, speedToPacePerMile } from "@/lib/utils/units";

function EffortCell({ effort, dim = false }: { effort: BestEffort | null; dim?: boolean }) {
  if (!effort) return <td className="num muted" colSpan={2}>—</td>;
  return (
    <>
      <td className="num" style={{ color: dim ? "var(--text-2)" : "var(--text-1)", fontWeight: dim ? 400 : 500 }}>
        <Link href={`/activities/${effort.activity_id}`} style={{ color: "inherit", textDecoration: "none" }}>
          {formatDuration(Math.round(effort.elapsed_time_s))}
        </Link>
      </td>
      <td className="num muted">{speedToPacePerMile(effort.distance_m / effort.elapsed_time_s)}/mi</td>
    </>
  );
}

export function PeaksTable({
  rows,
  recentWeeks,
  missing,
}: {
  rows: PeakRow[];
  recentWeeks: number;
  missing: number;
}) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: "16px 18px 4px" }}>
        <CardHeader
          title="Peak Performances"
          action={missing > 0 ? `${missing} runs still syncing from Strava` : "Fastest segment inside any run"}
        />
      </div>
      {rows.length === 0 ? (
        <div className="muted" style={{ padding: "8px 18px 18px", fontSize: 12 }}>
          No best efforts yet — they arrive with the next Strava sync.
        </div>
      ) : (
        <table className="tbl" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Distance</th>
              <th className="num">All-time</th>
              <th className="num">Pace</th>
              <th className="num">Set</th>
              <th className="num">Last {recentWeeks}w</th>
              <th className="num">Pace</th>
              <th className="num">Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const gap = r.recent && !r.isRecentPr ? r.recent.elapsed_time_s - r.allTime.elapsed_time_s : null;
              return (
                <tr key={r.name}>
                  <td>
                    {r.name} {r.isRecentPr && <Pill kind="accent">PR</Pill>}
                  </td>
                  <EffortCell effort={r.allTime} />
                  <td className="num muted">{r.allTime.date}</td>
                  <EffortCell effort={r.recent} dim />
                  <td className="num muted">
                    {gap != null ? `+${formatDuration(Math.round(gap))}` : r.isRecentPr ? "—" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
