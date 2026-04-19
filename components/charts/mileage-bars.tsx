import type { WeekMileage } from "@/lib/types";
import { metersToMiles } from "@/lib/utils/units";

interface MileageBarsProps {
  weeks: WeekMileage[];
  width?: number;
  height?: number;
  currentIndex: number;
}

export function MileageBars({
  weeks,
  width = 800,
  height = 180,
  currentIndex,
}: MileageBarsProps) {
  const w = width;
  const h = height;
  const padL = 36;
  const padR = 10;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  // Convert to miles for display axis
  const plannedMi = weeks.map((wk) => metersToMiles(wk.planned_m));
  const actualMi = weeks.map((wk) =>
    wk.actual_m == null ? null : metersToMiles(wk.actual_m)
  );

  const maxY =
    Math.max(
      ...plannedMi,
      ...actualMi.map((v) => v ?? 0)
    ) * 1.05;
  const bw = innerW / weeks.length;
  const gap = 3;
  const yTicks = [0, 20, 40, 60];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-frame">
      {yTicks.map((v, i) => {
        const y = padT + (1 - v / maxY) * innerH;
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
            <text
              x={padL - 8}
              y={y + 3}
              textAnchor="end"
              className="axis-tick"
            >
              {v}
            </text>
          </g>
        );
      })}
      {weeks.map((wk, i) => {
        const x = padL + i * bw + gap / 2;
        const bwInner = bw - gap;
        const pMi = plannedMi[i];
        const aMi = actualMi[i];
        const plannedH = (pMi / maxY) * innerH;
        const actualH = ((aMi ?? 0) / maxY) * innerH;
        const py = padT + innerH - plannedH;
        const ay = padT + innerH - actualH;
        const isCurrent = i === currentIndex;
        const isFuture = aMi === null;
        return (
          <g key={i}>
            {/* Planned ghost bar */}
            <rect
              x={x}
              y={py}
              width={bwInner}
              height={plannedH}
              fill={isFuture ? "var(--surface-3)" : "rgba(142,245,66,0.08)"}
              stroke={isFuture ? "var(--hairline-strong)" : "transparent"}
              strokeDasharray={isFuture ? "2 2" : ""}
              rx="2"
            />
            {/* Actual solid bar */}
            {aMi !== null && (
              <rect
                x={x + 1}
                y={ay}
                width={bwInner - 2}
                height={actualH}
                fill={isCurrent ? "var(--accent)" : "var(--accent-dim)"}
                opacity={isCurrent ? 1 : 0.75}
                rx="2"
              />
            )}
            {isCurrent && (
              <rect
                x={x}
                y={padT}
                width={bwInner}
                height={innerH}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1"
                opacity="0.25"
                rx="2"
              />
            )}
            <text
              x={x + bwInner / 2}
              y={h - 10}
              textAnchor="middle"
              className="axis-tick"
              opacity={isCurrent ? 1 : 0.7}
            >
              {wk.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
