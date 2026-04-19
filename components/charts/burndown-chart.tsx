import { useId } from "react";
import type { WeekMileage } from "@/lib/types";
import { metersToMiles } from "@/lib/utils/units";

interface BurndownChartProps {
  weeks: WeekMileage[];
  currentWeek: number; // 0-indexed
  width?: number;
  height?: number;
}

export function BurndownChart({
  weeks,
  currentWeek,
  width = 900,
  height = 300,
}: BurndownChartProps) {
  const planGradId = useId();
  const actualGradId = useId();
  const w = width;
  const h = height;
  const padL = 50;
  const padR = 20;
  const padT = 24;
  const padB = 40;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  // Cumulative mileage (in miles for axis readability)
  let cpl = 0;
  let cac = 0;
  const cumPlan: number[] = weeks.map((wk) => (cpl += metersToMiles(wk.planned_m)));
  const cumActual: (number | null)[] = weeks.map((wk) => {
    if (wk.actual_m == null) return null;
    cac += metersToMiles(wk.actual_m);
    return cac;
  });

  const maxY = Math.max(...cumPlan) * 1.05;
  const xFor = (i: number) => padL + (i / (weeks.length - 1)) * innerW;
  const yFor = (v: number) => padT + (1 - v / maxY) * innerH;

  const planPath = cumPlan
    .map((v, i) => `${i ? "L" : "M"} ${xFor(i)} ${yFor(v)}`)
    .join(" ");

  const actualPts = cumActual
    .map((v, i) => (v === null ? null : [xFor(i), yFor(v)]))
    .filter((v): v is [number, number] => v !== null);
  const actualPath = actualPts
    .map((p, i) => `${i ? "L" : "M"} ${p[0]} ${p[1]}`)
    .join(" ");

  const planArea = `${planPath} L ${xFor(weeks.length - 1)} ${padT + innerH} L ${padL} ${
    padT + innerH
  } Z`;
  const actualArea =
    actualPts.length > 0
      ? `${actualPath} L ${actualPts[actualPts.length - 1][0]} ${padT + innerH} L ${padL} ${
          padT + innerH
        } Z`
      : "";

  const yTicks = [0, 150, 300, 450, 600];
  const currentX = xFor(currentWeek);

  // Find last actual index without using findLastIndex (broader browser support)
  let lastActualI = -1;
  for (let i = cumActual.length - 1; i >= 0; i--) {
    if (cumActual[i] !== null) {
      lastActualI = i;
      break;
    }
  }
  const lastActualV = lastActualI >= 0 ? (cumActual[lastActualI] as number) : 0;
  const plannedAtNow = lastActualI >= 0 ? cumPlan[lastActualI] : 0;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-frame">
      <defs>
        <linearGradient id={planGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--text-3)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--text-3)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={actualGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* gridlines */}
      {yTicks.map((v, i) => {
        const y = yFor(v);
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={y}
              x2={w - padR}
              y2={y}
              className="axis-line"
              strokeDasharray={i === 0 ? "" : "2 3"}
              opacity={i === 0 ? 0.6 : 0.35}
            />
            <text x={padL - 10} y={y + 3} textAnchor="end" className="axis-tick">
              {v}
            </text>
          </g>
        );
      })}
      <text x={padL - 10} y={padT - 6} textAnchor="end" className="axis-label">
        miles
      </text>

      {/* plan area (grey) */}
      <path d={planArea} fill={`url(#${planGradId})`} />
      <path
        d={planPath}
        stroke="var(--text-3)"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="4 3"
        opacity="0.8"
      />

      {/* actual area (accent) */}
      {actualArea && <path d={actualArea} fill={`url(#${actualGradId})`} />}
      {actualPath && (
        <path d={actualPath} stroke="var(--accent)" strokeWidth="2.5" fill="none" />
      )}

      {/* today line */}
      <line
        x1={currentX}
        y1={padT}
        x2={currentX}
        y2={padT + innerH}
        stroke="var(--accent)"
        strokeWidth="1"
        opacity="0.6"
      />
      <rect
        x={currentX - 32}
        y={padT - 14}
        width="64"
        height="14"
        rx="3"
        fill="var(--surface-3)"
      />
      <text
        x={currentX}
        y={padT - 4}
        textAnchor="middle"
        fontSize="10"
        fontFamily="var(--font-geist-mono), monospace"
        fill="var(--accent)"
        style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        Now · W{currentWeek + 1}
      </text>

      {/* endpoint dot + value */}
      {lastActualI >= 0 && (
        <>
          <circle
            cx={xFor(lastActualI)}
            cy={yFor(lastActualV)}
            r="4"
            fill="var(--accent)"
          />
          <circle
            cx={xFor(lastActualI)}
            cy={yFor(lastActualV)}
            r="7"
            fill="none"
            stroke="var(--accent)"
            opacity="0.25"
            strokeWidth="2"
          />
        </>
      )}

      <circle
        cx={xFor(weeks.length - 1)}
        cy={yFor(cumPlan[cumPlan.length - 1])}
        r="3"
        fill="var(--text-2)"
      />

      {/* x labels */}
      {weeks.map((wk, i) => {
        if (i % 2 !== 0 && i !== weeks.length - 1) return null;
        return (
          <text
            key={i}
            x={xFor(i)}
            y={h - 14}
            textAnchor="middle"
            className="axis-tick"
            opacity={i === currentWeek ? 1 : 0.7}
          >
            {wk.label}
          </text>
        );
      })}

      {/* gap callout */}
      {lastActualI >= 0 && (
        <g>
          <line
            x1={currentX + 2}
            y1={yFor(lastActualV)}
            x2={currentX + 2}
            y2={yFor(plannedAtNow)}
            stroke="var(--amber)"
            strokeWidth="1"
          />
          <text
            x={currentX + 8}
            y={(yFor(lastActualV) + yFor(plannedAtNow)) / 2 + 3}
            fontSize="10"
            fontFamily="var(--font-geist-mono), monospace"
            fill="var(--amber)"
          >
            −{(plannedAtNow - lastActualV).toFixed(1)}mi
          </text>
        </g>
      )}

      {/* legend */}
      <g transform={`translate(${w - padR - 180}, ${padT + 4})`}>
        <rect
          x="0"
          y="-10"
          width="180"
          height="38"
          fill="var(--surface-2)"
          stroke="var(--hairline)"
          rx="4"
        />
        <line
          x1="10"
          y1="0"
          x2="26"
          y2="0"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        <text
          x="32"
          y="3"
          fontSize="10"
          fontFamily="var(--font-geist-mono), monospace"
          fill="var(--text-1)"
          letterSpacing="0.06em"
          style={{ textTransform: "uppercase" }}
        >
          Actual {lastActualV.toFixed(0)}mi
        </text>
        <line
          x1="10"
          y1="16"
          x2="26"
          y2="16"
          stroke="var(--text-3)"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <text
          x="32"
          y="19"
          fontSize="10"
          fontFamily="var(--font-geist-mono), monospace"
          fill="var(--text-2)"
          letterSpacing="0.06em"
          style={{ textTransform: "uppercase" }}
        >
          Plan {cumPlan[cumPlan.length - 1].toFixed(0)}mi
        </text>
      </g>
    </svg>
  );
}
