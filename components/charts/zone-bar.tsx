import type { HRZone } from "@/lib/types";

const ZONE_COLORS = [
  "var(--zone-1)",
  "var(--zone-2)",
  "var(--zone-3)",
  "var(--zone-4)",
  "var(--zone-5)",
];

export function ZoneBar({
  zones,
  showLabels = true,
}: {
  zones: HRZone[];
  showLabels?: boolean;
}) {
  return (
    <div className="col gap-6">
      <div className="zone-bar">
        {zones.map((z, i) => (
          <div
            key={z.zone}
            className="zone-seg"
            style={{
              background: ZONE_COLORS[i],
              flex: z.pct,
              color: i < 2 ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)",
            }}
          >
            {z.pct >= 8 && <span>{z.pct}%</span>}
          </div>
        ))}
      </div>
      {showLabels && (
        <div
          className="row between"
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 10,
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {zones.map((z) => (
            <span key={z.zone}>{z.zone}</span>
          ))}
        </div>
      )}
    </div>
  );
}
