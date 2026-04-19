import type { ReactNode } from "react";

interface RingProps {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  value?: ReactNode;
  unit?: string;
}

export function Ring({
  pct,
  size = 120,
  stroke = 7,
  color = "var(--accent)",
  label,
  value,
  unit,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--surface-3)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms ease-out" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {label && <div className="stat-label" style={{ marginBottom: 0 }}>{label}</div>}
        <div className="row baseline gap-4">
          <span className="stat-num md">{value}</span>
          {unit && <span className="stat-unit">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
