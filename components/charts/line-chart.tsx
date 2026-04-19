import { useId } from "react";

interface LineChartProps {
  data: number[];
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
}

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
}: LineChartProps) {
  const gradId = useId();
  const w = width;
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
    (_, i) => mn + (range * i) / (yTicks - 1)
  );
  const approxLen = Math.round(innerW * 1.2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-frame">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yVals.map((v, i) => {
        const y = padT + (1 - (v - mn) / range) * innerH;
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
              {Math.round(v)}
              {unit}
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
        className={animate ? "draw" : ""}
        style={
          animate
            ? ({ "--dash": approxLen } as React.CSSProperties)
            : undefined
        }
      />
    </svg>
  );
}
