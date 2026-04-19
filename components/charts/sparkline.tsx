import { useId } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
}

export function Sparkline({
  data,
  width = 120,
  height = 28,
  stroke = "var(--accent)",
  fill = true,
}: SparklineProps) {
  const gid = useId();
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const range = mx - mn || 1;
  const xs = data.map((_, i) => (i / (data.length - 1)) * width);
  const ys = data.map((d) => (1 - (d - mn) / range) * height);
  const path = xs.map((x, i) => `${i ? "L" : "M"} ${x} ${ys[i]}`).join(" ");
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  // Use CSS `color` so callers can pass either a hex or a CSS var like
  // var(--accent); SVG stops + stroke inherit via currentColor.
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="sparkline"
      style={{ color: stroke }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path
        d={path}
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
