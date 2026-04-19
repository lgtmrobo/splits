import { useId } from "react";

interface RouteMapProps {
  /** Points in normalized 0..1 x 0..1 space. */
  points: [number, number][];
  height?: number;
  showLabels?: boolean;
  showStats?: boolean;
  dimmed?: boolean;
  glow?: boolean;
  /** Optional header pill, e.g. "Riverside loop · 8.3mi" */
  titleLabel?: string;
  /** Optional bottom-right meta, e.g. "Portland, OR · 6:02 AM" */
  metaLabel?: string;
}

export function RouteMap({
  points,
  height = 360,
  showLabels = true,
  showStats = true,
  dimmed = false,
  glow = true,
  titleLabel,
  metaLabel,
}: RouteMapProps) {
  const glowId = useId();
  const blob1 = useId();
  const blob2 = useId();
  const contour = useId();

  const w = 800;
  const h = height;
  const padding = 20;
  const xs = points.map((p) => padding + p[0] * (w - 2 * padding));
  const ys = points.map((p) => padding + p[1] * (h - 2 * padding));
  const d = xs.map((x, i) => `${i ? "L" : "M"} ${x} ${ys[i]}`).join(" ");

  // mile markers — roughly one per 17 points of the 140-point demo route
  const markers: { x: number; y: number; mi: number }[] = [];
  const miEvery = 17;
  for (let i = miEvery; i < points.length; i += miEvery) {
    markers.push({ x: xs[i], y: ys[i], mi: Math.round(i / miEvery) });
  }

  const start: [number, number] = [xs[0], ys[0]];
  const end: [number, number] = [xs[xs.length - 1], ys[ys.length - 1]];

  return (
    <div className="map-frame" style={{ height: h }}>
      <div className="map-grid" />
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="map-terrain"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id={blob1} cx="30%" cy="40%" r="40%">
            <stop offset="0" stopColor="#1a1a22" stopOpacity="0.8" />
            <stop offset="1" stopColor="#0A0A0C" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={blob2} cx="75%" cy="70%" r="35%">
            <stop offset="0" stopColor="#14141a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#0A0A0C" stopOpacity="0" />
          </radialGradient>
          <pattern
            id={contour}
            x="0"
            y="0"
            width="180"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M -20 40 Q 60 10 140 50 T 320 40"
              stroke="rgba(255,255,255,0.025)"
              fill="none"
              strokeWidth="1"
            />
            <path
              d="M -20 80 Q 60 50 140 90 T 320 80"
              stroke="rgba(255,255,255,0.025)"
              fill="none"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={w} height={h} fill={`url(#${blob1})`} />
        <rect width={w} height={h} fill={`url(#${blob2})`} />
        <rect width={w} height={h} fill={`url(#${contour})`} />
        {/* river */}
        <path
          d="M 0 260 Q 200 210 400 250 T 800 220"
          stroke="rgba(107, 168, 232, 0.08)"
          strokeWidth="24"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 0 260 Q 200 210 400 250 T 800 220"
          stroke="rgba(107, 168, 232, 0.18)"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {glow && (
          <path
            d={d}
            stroke="var(--accent)"
            strokeWidth="8"
            fill="none"
            opacity={dimmed ? 0.25 : 0.45}
            filter={`url(#${glowId})`}
          />
        )}
        <path
          d={d}
          stroke="var(--accent)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={dimmed ? 0.7 : 1}
        />
        <path
          d={d}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {showLabels &&
          markers.map((m, i) => (
            <g key={i}>
              <circle
                cx={m.x}
                cy={m.y}
                r="3"
                fill="var(--bg)"
                stroke="var(--accent)"
                strokeWidth="1"
              />
              <text
                x={m.x + 7}
                y={m.y + 3}
                fontSize="9"
                fontFamily="var(--font-geist-mono), monospace"
                fill="var(--text-2)"
              >
                {m.mi}
              </text>
            </g>
          ))}

        <circle
          cx={start[0]}
          cy={start[1]}
          r="7"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
          opacity="0.5"
        />
        <circle cx={start[0]} cy={start[1]} r="3.5" fill="var(--accent)" />
        {showLabels && (
          <text
            x={start[0] + 10}
            y={start[1] + 4}
            fontSize="10"
            fontFamily="var(--font-geist-mono), monospace"
            fill="var(--text-1)"
            letterSpacing="0.06em"
            style={{ textTransform: "uppercase" }}
          >
            Start
          </text>
        )}

        <circle
          cx={end[0]}
          cy={end[1]}
          r="4"
          fill="var(--bg)"
          stroke="var(--accent)"
          strokeWidth="1.5"
        />
        {showLabels && (
          <text
            x={end[0] + 10}
            y={end[1] + 4}
            fontSize="10"
            fontFamily="var(--font-geist-mono), monospace"
            fill="var(--text-1)"
            letterSpacing="0.06em"
            style={{ textTransform: "uppercase" }}
          >
            Finish
          </text>
        )}
      </svg>

      {showStats && titleLabel && (
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 16,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span className="pill accent">{titleLabel}</span>
        </div>
      )}
      {showStats && metaLabel && (
        <div
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-end",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 10,
              color: "var(--text-3)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {metaLabel}
          </span>
        </div>
      )}
    </div>
  );
}
