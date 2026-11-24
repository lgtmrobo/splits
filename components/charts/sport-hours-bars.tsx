"use client";

import { useState } from "react";
import { SPORT_COLORS } from "@/lib/activities/sports";
import type { WeekHours } from "@/lib/tri/summary";

const SPORTS = [
  { key: "swim_s", label: "Swim", color: SPORT_COLORS.swim },
  { key: "bike_s", label: "Bike", color: SPORT_COLORS.bike },
  { key: "run_s", label: "Run", color: SPORT_COLORS.run },
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtWeek(iso: string): string {
  return `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;
}

function fmtHours(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Weekly training hours, stacked swim / bike / run, oldest week first. */
export function SportHoursBars({ weeks, height = 160 }: { weeks: WeekHours[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = (w: WeekHours) => w.swim_s + w.bike_s + w.run_s;
  const max = Math.max(3600, ...weeks.map(total));
  const shown = hover != null ? weeks[hover] : null;

  return (
    <div className="col gap-8">
      <div className="row gap-14 wrap" style={{ fontSize: 11, color: "var(--text-2)" }}>
        {SPORTS.map((s) => (
          <span key={s.key} className="row gap-6" style={{ alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <div
          className="row"
          style={{ alignItems: "flex-end", gap: 4, height }}
          onMouseLeave={() => setHover(null)}
        >
          {weeks.map((w, i) => {
            const t = total(w);
            return (
              <div
                key={w.start}
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(i)}
                style={{
                  flex: 1,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column-reverse",
                  gap: t > 0 ? 2 : 0,
                  opacity: hover == null || hover === i ? 1 : 0.55,
                  cursor: "default",
                }}
              >
                {SPORTS.map((s, j) => {
                  const v = w[s.key];
                  if (v <= 0) return null;
                  // Rounded data-end on the top segment only.
                  const isTop = SPORTS.slice(j + 1).every((n) => w[n.key] <= 0);
                  return (
                    <div
                      key={s.key}
                      style={{
                        height: `${(v / max) * 100}%`,
                        minHeight: 2,
                        background: s.color,
                        borderRadius: isTop ? "4px 4px 0 0" : 0,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {shown && (
          <div
            className="card"
            style={{
              position: "absolute",
              top: 0,
              [hover! < weeks.length / 2 ? "left" : "right"]: 0,
              padding: "8px 10px",
              fontSize: 11,
              pointerEvents: "none",
              background: "var(--surface-2)",
              minWidth: 130,
            }}
          >
            <div style={{ color: "var(--text-1)", marginBottom: 4 }}>
              Week of {fmtWeek(shown.start)} · {fmtHours(total(shown))}
            </div>
            {SPORTS.map((s) => (
              <div key={s.key} className="row between gap-10" style={{ color: "var(--text-2)" }}>
                <span className="row gap-6" style={{ alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 1, background: s.color }} />
                  {s.label}
                </span>
                <span className="num">{fmtHours(shown[s.key])}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row between muted num" style={{ fontSize: 10 }}>
        <span>{fmtWeek(weeks[0].start)}</span>
        <span>This week</span>
      </div>

      <table className="sr-only">
        <caption>Weekly training hours by sport</caption>
        <thead>
          <tr>
            <th>Week of</th>
            {SPORTS.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <td>{w.start}</td>
              {SPORTS.map((s) => (
                <td key={s.key}>{fmtHours(w[s.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
