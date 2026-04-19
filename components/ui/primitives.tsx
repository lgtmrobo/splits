import type { ReactNode } from "react";

// ============================================================
// Pill
// ============================================================

type PillKind = "default" | "accent" | "warn" | "red" | "muted";

export function Pill({
  children,
  kind = "default",
}: {
  children: ReactNode;
  kind?: PillKind;
}) {
  const cls = kind === "default" ? "pill" : `pill ${kind}`;
  return <span className={cls}>{children}</span>;
}

// ============================================================
// Stat block (label + big number + optional unit + optional delta)
// ============================================================

type StatSize = "md" | "lg" | "xl";
type DeltaKind = "up" | "down" | "warn" | "";

export function Stat({
  label,
  value,
  unit,
  size = "md",
  delta,
  deltaKind,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  size?: StatSize;
  delta?: ReactNode;
  deltaKind?: DeltaKind;
}) {
  return (
    <div className="col">
      <div className="stat-label">{label}</div>
      <div className="row baseline gap-4">
        <span className={`stat-num ${size}`}>{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {delta && (
        <div
          className={`stat-delta ${deltaKind || ""}`}
          style={{ marginTop: 4 }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Card header (eyebrow title + action text)
// ============================================================

export function CardHeader({
  title,
  action,
  accent = false,
}: {
  title: string;
  action?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card-header">
      <div className={`card-title ${accent ? "accent" : ""}`}>{title}</div>
      {action && <div className="card-action">{action}</div>}
    </div>
  );
}
