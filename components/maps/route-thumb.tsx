import { decodePolyline, normalizePoints } from "@/lib/strava/polyline";

interface RouteThumbProps {
  /** Strava encoded polyline. If present, used to draw the real route. */
  polyline?: string | null;
  /** Fallback synthetic shape if no polyline. */
  seed?: number;
  size?: number;
}

function pointsFromPolyline(p: string, size: number): [number, number][] {
  const decoded = decodePolyline(p);
  if (decoded.length < 2) return [];
  const norm = normalizePoints(decoded);
  const pad = 6;
  const inner = size - pad * 2;
  return norm.map(([x, y]) => [pad + x * inner, pad + y * inner]);
}

function syntheticPoints(seed: number, size: number): [number, number][] {
  const rand = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297) * 233280;
    return x - Math.floor(x);
  };
  const N = 28;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const rx = 0.5 + 0.35 * Math.sin(t * Math.PI * 2 + rand(0) * 6) + (rand(i) - 0.5) * 0.08;
    const ry = 0.5 + 0.35 * Math.cos(t * Math.PI * 1.6 + rand(1) * 6) + (rand(i + 7) - 0.5) * 0.08;
    pts.push([rx * size, ry * size]);
  }
  return pts;
}

export function RouteThumb({ polyline, seed = 0, size = 68 }: RouteThumbProps) {
  const pts = polyline ? pointsFromPolyline(polyline, size) : [];
  const usePts = pts.length > 1 ? pts : syntheticPoints(seed, size);
  const hasReal = pts.length > 1;
  const d = usePts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#0E0E12",
        borderRadius: 8,
        border: "1px solid var(--hairline)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={d}
          stroke={hasReal ? "var(--accent)" : "var(--text-3)"}
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={hasReal ? 0.9 : 0.5}
        />
        <circle cx={usePts[0][0]} cy={usePts[0][1]} r="1.8" fill={hasReal ? "var(--accent)" : "var(--text-3)"} />
      </svg>
    </div>
  );
}
