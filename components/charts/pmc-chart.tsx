"use client";

// Performance Management Chart: Fitness (CTL) and Fatigue (ATL) lines on
// top, Form (TSB) bars below, with today and race markers. Everything right
// of "today" is projected from planned runs and drawn dashed / faded.

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";

export interface PmcChartPoint {
  date: string;
  tss: number;
  ctl: number;
  atl: number;
  tsb: number;
  projected: boolean;
}

interface PmcChartProps {
  points: PmcChartPoint[];
  todayIndex: number;
  races: Array<{ date: string; name: string }>;
  height?: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PAD_L = 34;
const PAD_R = 10;
/** Room for two staggered rows of race labels. */
const PAD_T = 32;
const GAP = 14;
const FORM_H = 64;
const AXIS_H = 18;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function formColor(tsb: number): string {
  if (tsb > 25) return "var(--blue)";
  if (tsb > 5) return "var(--accent)";
  if (tsb >= -10) return "var(--text-4)";
  if (tsb >= -30) return "var(--amber)";
  return "var(--red)";
}

function fmtDate(iso: string): string {
  return `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;
}

function linePath(xs: number[], ys: number[], from: number, to: number): string {
  let d = "";
  for (let i = from; i <= to; i++) d += `${i === from ? "M" : "L"} ${xs[i]} ${ys[i]} `;
  return d;
}

export function PmcChart({ points, todayIndex, races, height = 260 }: PmcChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setW(width);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) {
    return <div className="muted" style={{ fontSize: 12 }}>Not enough data yet.</div>;
  }

  const innerW = w - PAD_L - PAD_R;
  const loadH = height - PAD_T - GAP - FORM_H - AXIS_H;
  const loadTop = PAD_T;
  const formTop = PAD_T + loadH + GAP;
  const formMid = formTop + FORM_H / 2;

  const maxLoad = Math.max(10, ...points.map((p) => Math.max(p.ctl, p.atl))) * 1.08;
  const maxAbsTsb = Math.max(15, ...points.map((p) => Math.abs(p.tsb)));
  const step = innerW / (points.length - 1);
  const xs = points.map((_, i) => PAD_L + i * step);
  const yLoad = (v: number) => loadTop + (1 - v / maxLoad) * loadH;
  const ctlY = points.map((p) => yLoad(p.ctl));
  const atlY = points.map((p) => yLoad(p.atl));
  const lastActual = todayIndex >= 0 ? todayIndex : points.length - 1;
  const hasProjection = lastActual < points.length - 1;
  const barW = Math.max(1, step * 0.7);

  const loadTicks = [0, 0.5, 1].map((t) => Math.round(maxLoad * t));
  const monthTicks = points
    .map((p, i) => ({ i, p }))
    .filter(({ p }) => p.date.endsWith("-01"));
  const raceIdx = races
    .map((r) => ({ ...r, i: points.findIndex((p) => p.date === r.date) }))
    .filter((r) => r.i >= 0);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round((x - PAD_L) / step);
    setHover(i >= 0 && i < points.length ? i : null);
  };
  const hp = hover != null ? points[hover] : null;

  return (
    <div ref={wrapRef} className="chart-frame" style={{ width: "100%", height, position: "relative" }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width={w}
        height={height}
        style={{ display: "block", width: "100%", height: "100%" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Fitness, fatigue and form over time"
      >
        {loadTicks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={w - PAD_R} y1={yLoad(v)} y2={yLoad(v)} className="axis-line" strokeDasharray={v ? "2 3" : ""} opacity={0.4} />
            <text x={PAD_L - 8} y={yLoad(v) + 3} textAnchor="end" className="axis-tick">{v}</text>
          </g>
        ))}
        <line x1={PAD_L} x2={w - PAD_R} y1={formMid} y2={formMid} className="axis-line" opacity={0.6} />
        <text x={PAD_L - 8} y={formTop + 8} textAnchor="end" className="axis-tick">+{Math.round(maxAbsTsb)}</text>
        <text x={PAD_L - 8} y={formTop + FORM_H} textAnchor="end" className="axis-tick">−{Math.round(maxAbsTsb)}</text>

        {hasProjection && (
          <rect x={xs[lastActual]} y={PAD_T - 8} width={w - PAD_R - xs[lastActual]} height={height - PAD_T - AXIS_H + 8} fill="var(--surface-2)" opacity={0.5} />
        )}

        {points.map((p, i) => {
          const h = (Math.abs(p.tsb) / maxAbsTsb) * (FORM_H / 2);
          return (
            <rect
              key={p.date}
              x={xs[i] - barW / 2}
              y={p.tsb >= 0 ? formMid - h : formMid}
              width={barW}
              height={Math.max(h, 0.5)}
              fill={formColor(p.tsb)}
              opacity={p.projected ? 0.45 : 0.9}
            />
          );
        })}

        <path d={linePath(xs, atlY, 0, lastActual)} fill="none" stroke="var(--purple)" strokeWidth={1.5} opacity={0.85} />
        <path d={linePath(xs, ctlY, 0, lastActual)} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
        {hasProjection && (
          <>
            <path d={linePath(xs, atlY, lastActual, points.length - 1)} fill="none" stroke="var(--purple)" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />
            <path d={linePath(xs, ctlY, lastActual, points.length - 1)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} />
          </>
        )}

        {todayIndex >= 0 && (
          <g>
            <line x1={xs[todayIndex]} x2={xs[todayIndex]} y1={PAD_T - 8} y2={height - AXIS_H} stroke="var(--text-3)" strokeWidth={1} />
            <text x={xs[todayIndex] + 4} y={height - AXIS_H - 4} className="axis-tick">Today</text>
          </g>
        )}
        {raceIdx.map((r, k) => (
          <g key={r.date + r.name}>
            <line x1={xs[r.i]} x2={xs[r.i]} y1={PAD_T - 8 - (k % 2) * 12} y2={height - AXIS_H} stroke="var(--red)" strokeWidth={1} strokeDasharray="2 2" />
            {/* Alternate rows so neighbouring races don't collide. */}
            <text x={xs[r.i] - 4} y={PAD_T - 10 - (k % 2) * 12} textAnchor="end" className="axis-tick" style={{ fill: "var(--red)" }}>
              {r.name.length > 18 ? `${r.name.slice(0, 17)}…` : r.name}
            </text>
          </g>
        ))}

        {monthTicks.map(({ i, p }) => (
          <text key={p.date} x={xs[i]} y={height - 4} textAnchor="middle" className="axis-tick">
            {MONTHS[+p.date.slice(5, 7) - 1]}
          </text>
        ))}

        {hover != null && (
          <g pointerEvents="none">
            <line x1={xs[hover]} x2={xs[hover]} y1={PAD_T - 8} y2={height - AXIS_H} stroke="var(--text-2)" strokeWidth={1} opacity={0.6} />
            <circle cx={xs[hover]} cy={ctlY[hover]} r={3} fill="var(--accent)" />
            <circle cx={xs[hover]} cy={atlY[hover]} r={3} fill="var(--purple)" />
          </g>
        )}
      </svg>

      {hp && hover != null && (
        <div
          className="card compact"
          style={{
            position: "absolute",
            top: 8,
            left: xs[hover] > w / 2 ? undefined : Math.min(xs[hover] + 12, w - 170),
            right: xs[hover] > w / 2 ? w - xs[hover] + 12 : undefined,
            pointerEvents: "none",
            background: "var(--surface-1)",
            border: "1px solid var(--hairline-strong)",
            zIndex: 2,
            fontSize: 11,
            padding: "8px 10px",
            minWidth: 150,
          }}
        >
          <div className="row between" style={{ marginBottom: 4 }}>
            <strong>{fmtDate(hp.date)}</strong>
            {hp.projected && <span className="muted">planned</span>}
          </div>
          <div className="row between"><span style={{ color: "var(--accent)" }}>Fitness</span><span className="num">{hp.ctl.toFixed(1)}</span></div>
          <div className="row between"><span style={{ color: "var(--purple)" }}>Fatigue</span><span className="num">{hp.atl.toFixed(1)}</span></div>
          <div className="row between"><span style={{ color: formColor(hp.tsb) }}>Form</span><span className="num">{hp.tsb >= 0 ? "+" : ""}{hp.tsb.toFixed(1)}</span></div>
          <div className="row between muted"><span>TSS</span><span className="num">{Math.round(hp.tss)}</span></div>
        </div>
      )}
    </div>
  );
}
