export function LoadStrip({
  data,
  height = 48,
  max,
}: {
  data: number[];
  height?: number;
  max?: number;
}) {
  const mx = max ?? Math.max(...data);
  const colorFor = (v: number): string => {
    if (v === 0) return "var(--surface-3)";
    if (v < 30) return "var(--zone-2)";
    if (v < 60) return "var(--zone-3)";
    if (v < 85) return "var(--zone-4)";
    return "var(--zone-5)";
  };
  return (
    <div className="load-strip" style={{ height }}>
      {data.map((v, i) => {
        const h = v === 0 ? 4 : Math.max(6, (v / mx) * height);
        return (
          <div
            key={i}
            className="load-bar"
            style={{
              height: h,
              background: colorFor(v),
              opacity: v === 0 ? 0.5 : 1,
            }}
            title={`Day ${i + 1}: ${v}`}
          />
        );
      })}
    </div>
  );
}
