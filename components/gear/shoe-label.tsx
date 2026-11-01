// Shoe name(s) with color dots for an activity — "Triumph 22" for a normal
// run, "Agravic SL + Triumph 22" when the run was split across pairs.
import type { Gear } from "@/lib/types";

export function ShoeDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

export function ShoeLabel({
  gearIds,
  gearById,
}: {
  gearIds: string[];
  gearById: Map<string, Gear>;
}) {
  const shoes = gearIds
    .map((id) => gearById.get(id))
    .filter((g): g is Gear => g != null);
  if (shoes.length === 0) return <>—</>;
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
    >
      {shoes.map((shoe, i) => (
        <span
          key={shoe.id}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {i > 0 && <span style={{ color: "var(--text-4)" }}>+</span>}
          <ShoeDot color={shoe.color} />
          {shoe.name}
        </span>
      ))}
    </span>
  );
}
