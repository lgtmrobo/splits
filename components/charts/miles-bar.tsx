export function MilesBar({
  miles,
  cap,
  color = "var(--accent)",
}: {
  miles: number;
  cap: number;
  color?: string;
}) {
  const pct = Math.min(100, (miles / cap) * 100);
  const warn = pct > 70;
  const danger = pct > 90;
  const c = danger ? "var(--red)" : warn ? "var(--amber)" : color;
  return (
    <div
      style={{
        position: "relative",
        height: 6,
        background: "var(--surface-3)",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          background: c,
        }}
      />
    </div>
  );
}
