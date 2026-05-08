"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

interface LineChartProps {
  data: number[];
  /** Fallback width if container measurement isn't available yet (SSR). */
  width?: number;
  height?: number;
  padL?: number;
  padR?: number;
  padT?: number;
  padB?: number;
  stroke?: string;
  fill?: boolean;
  yTicks?: number;
  xLabels?: Array<string | number> | null;
  minY?: number | null;
  maxY?: number | null;
  unit?: string;
  animate?: boolean;
  invertY?: boolean;
  smooth?: boolean;
  /** Built-in Y-axis label formatters. "pace" renders decimal min/mile as m:ss. */
  formatY?: "pace" | "int";
}

function paceLabel(v: number): string {
  const m = Math.floor(v);
  const s = Math.round((v - m) * 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatYValue(
  v: number,
  fmt: "pace" | "int" | undefined,
  unit: string,
): string {
  if (fmt === "pace") return paceLabel(v);
  return `${Math.round(v)}${unit}`;
}

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function LineChart({
  data,
  width = 600,
  height = 160,
  padL = 36,
  padR = 12,
  padT = 14,
  padB = 24,
  stroke = "var(--accent)",
  fill = true,
  yTicks = 4,
  xLabels = null,
  minY = null,
  maxY = null,
  unit = "",
  animate = true,
  invertY = false,
  smooth = true,
  formatY,
}: LineChartProps) {
  const gradId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [measuredW, setMeasuredW] = useState<number>(width);

  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) setMeasuredW(rect.width);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = Math.max(measuredW, padL + padR + 10);
  const h = height;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const mn = minY ?? Math.min(...data);
  const mx = maxY ?? Math.max(...data);
  const range = mx - mn || 1;
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * innerW);
  const ys = data.map((d) => {
    const t = (d - mn) / range;
    return padT + (invertY ? t : 1 - t) * innerH;
  });

  const path = xs
    .map((x, i) => {
      if (i === 0) return `M ${x} ${ys[i]}`;
      if (!smooth) return `L ${x} ${ys[i]}`;
      const px = xs[i - 1];
      const py = ys[i - 1];
      const cx = (px + x) / 2;
      return `C ${cx} ${py}, ${cx} ${ys[i]}, ${x} ${ys[i]}`;
    })
    .join(" ");

  const area = `${path} L ${xs[xs.length - 1]} ${padT + innerH} L ${xs[0]} ${
    padT + innerH
  } Z`;

  const yVals = Array.from(
    { length: yTicks },
    (_, i) => mn + (range * i) / (yTicks - 1),
  );
  let polyLen = 0;
  for (let i = 1; i < xs.length; i++) {
    polyLen += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  const approxLen = Math.ceil(polyLen * 1.3 + 20);

  return (
    <div
      ref={wrapRef}
      className="chart-frame"
      style={{ width: "100%", height: h }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yVals.map((v, i) => {
          const t = (v - mn) / range;
          const y = padT + (invertY ? t : 1 - t) * innerH;
          return (
            <g key={i}>
              <line
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                className="axis-line"
                strokeDasharray={i === 0 ? "" : "2 3"}
                opacity={i === 0 ? 0.6 : 0.4}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                className="axis-tick"
              >
                {formatYValue(v, formatY, unit)}
              </text>
            </g>
          );
        })}
        {xLabels &&
          xLabels.map((lbl, i) => {
            const x = padL + (i / (xLabels.length - 1)) * innerW;
            return (
              <text
                key={i}
                x={x}
                y={h - 6}
                textAnchor="middle"
                className="axis-tick"
              >
                {lbl}
              </text>
            );
          })}
        {fill && <path d={area} fill={`url(#${gradId})`} />}
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className={animate ? "draw" : ""}
          style={
            animate
              ? ({ "--dash": approxLen } as React.CSSProperties)
              : undefined
          }
        />
      </svg>
    </div>
  );
}
