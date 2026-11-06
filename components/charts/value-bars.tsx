// Plain single-series bar chart (weekly vertical, time on feet, …). The last
// bar is the in-progress period and is drawn faded.

interface ValueBarsProps {
  values: number[];
  labels: string[];
  width?: number;
  height?: number;
  color?: string;
  /** Formats y-axis ticks. */
  format?: (v: number) => string;
  /** Visual target line, e.g. a weekly vert goal. */
  reference?: number | null;
}

const PAD_L = 36;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 22;

export function ValueBars({
  values,
  labels,
  width = 600,
  height = 150,
  color = "var(--accent)",
  format = (v) => String(Math.round(v)),
  reference = null,
}: ValueBarsProps) {
  const innerW = width - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;
  const max = Math.max(1, reference ?? 0, ...values) * 1.08;
  const bw = innerW / Math.max(values.length, 1);
  const y = (v: number) => PAD_T + (1 - v / max) * innerH;
  const ticks = [0, max / 2, max];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-frame">
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            x2={width - PAD_R}
            y1={y(t)}
            y2={y(t)}
            className="axis-line"
            strokeDasharray={i ? "2 3" : ""}
            opacity={0.4}
          />
          <text
            x={PAD_L - 6}
            y={y(t) + 3}
            textAnchor="end"
            className="axis-tick"
          >
            {format(t)}
          </text>
        </g>
      ))}
      {values.map((v, i) => (
        <rect
          key={i}
          x={PAD_L + i * bw + 2}
          y={y(v)}
          width={Math.max(bw - 4, 1)}
          height={Math.max(PAD_T + innerH - y(v), 0)}
          rx={2}
          fill={color}
          opacity={i === values.length - 1 ? 0.45 : 0.85}
        >
          <title>{`${labels[i]}: ${format(v)}`}</title>
        </rect>
      ))}
      {reference != null && (
        <line
          x1={PAD_L}
          x2={width - PAD_R}
          y1={y(reference)}
          y2={y(reference)}
          stroke="var(--text-3)"
          strokeDasharray="4 3"
        />
      )}
      {labels.map((l, i) =>
        i % 2 === values.length % 2 ? null : (
          <text
            key={i}
            x={PAD_L + i * bw + bw / 2}
            y={height - 6}
            textAnchor="middle"
            className="axis-tick"
          >
            {l}
          </text>
        ),
      )}
    </svg>
  );
}
