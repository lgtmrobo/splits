import { Pill, Stat } from "@/components/ui/primitives";
import { getAllRaces } from "@/lib/supabase/queries";
import { formatDuration, metersToMiles } from "@/lib/utils/units";

export default async function RacesPage() {
  const races = await getAllRaces();
  const upcoming = races.filter((r) => r.status !== "completed");
  const past = races.filter((r) => r.status === "completed");

  const goalPace = (distance_m: number, goal_s: number): string => {
    const sec = goal_s / metersToMiles(distance_m);
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const raceDistanceLabel = (m: number): string => {
    const mi = metersToMiles(m);
    if (Math.abs(mi - 26.2) < 0.1) return "mi · marathon";
    if (Math.abs(mi - 13.1) < 0.1) return "mi · half";
    return "mi";
  };

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
            Races
          </h1>
          <div className="muted num" style={{ fontSize: 12 }}>
            {upcoming.length} upcoming · {past.length} completed
          </div>
        </div>
        <button type="button" className="btn primary">
          + Add race
        </button>
      </div>

      <div className="card-title" style={{ marginBottom: 8 }}>
        Upcoming
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 20 }}
      >
        {upcoming.map((r) => {
          const isA = r.priority === "A-race";
          const weeksOut = Math.max(
            0,
            Math.round(
              (new Date(r.race_date).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24 * 7)
            )
          );
          return (
            <div
              key={r.id}
              className="card"
              style={{
                background: isA
                  ? "linear-gradient(160deg, var(--surface-1), rgba(142,245,66,0.05))"
                  : "var(--surface-1)",
                border: isA
                  ? "1px solid rgba(142,245,66,0.3)"
                  : "1px solid var(--hairline)",
              }}
            >
              <div className="row between" style={{ marginBottom: 12 }}>
                <Pill kind={isA ? "accent" : "default"}>
                  {r.priority ?? "Upcoming"}
                </Pill>
                <span
                  className="num"
                  style={{ fontSize: 11, color: "var(--text-3)" }}
                >
                  {weeksOut}w out
                </span>
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  marginBottom: 4,
                }}
              >
                {r.name}
              </div>
              <div className="muted num" style={{ fontSize: 11, marginBottom: 14 }}>
                {r.race_date} · {r.location}
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  paddingTop: 12,
                  borderTop: "1px solid var(--hairline)",
                }}
              >
                <Stat
                  label="Distance"
                  value={metersToMiles(r.distance_m).toFixed(1)}
                  unit={raceDistanceLabel(r.distance_m)}
                />
                <Stat
                  label="Goal"
                  value={r.goal_time_s ? formatDuration(r.goal_time_s) : "—"}
                />
                <Stat
                  label="Pace"
                  value={r.goal_time_s ? goalPace(r.distance_m, r.goal_time_s) : "—"}
                  unit="/mi"
                />
              </div>
              {r.confidence != null && (
                <div style={{ marginTop: 12 }}>
                  <div className="row between" style={{ marginBottom: 4 }}>
                    <span className="stat-label" style={{ marginBottom: 0 }}>
                      Confidence
                    </span>
                    <span
                      className="num"
                      style={{ fontSize: 11, color: "var(--accent)" }}
                    >
                      {r.confidence}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "var(--surface-3)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${r.confidence}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card-title" style={{ marginBottom: 8 }}>
        Completed
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Race</th>
              <th>Location</th>
              <th className="num">Distance</th>
              <th className="num">Result</th>
              <th className="num">Pace</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {past.map((r) => (
              <tr key={r.id} className="clickable">
                <td className="num muted">{r.race_date}</td>
                <td>{r.name}</td>
                <td className="muted">{r.location}</td>
                <td className="num">{metersToMiles(r.distance_m).toFixed(1)}</td>
                <td
                  className="num"
                  style={{ color: "var(--text-1)", fontWeight: 500 }}
                >
                  {r.notes ?? "—"}
                </td>
                <td className="num">—</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
