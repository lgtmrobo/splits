// Shoe for an activity row — "● Triumph 22" for a normal run. A run split
// across pairs shows its first shoe plus a "+1" chip; hovering/focusing the
// chip lists every shoe with its miles.
import type { GearShare } from "@/lib/gear/segments";
import type { Gear } from "@/lib/types";
import { metersToMiles } from "@/lib/utils/units";

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
  shares,
  gearById,
}: {
  shares: GearShare[];
  gearById: Map<string, Gear>;
}) {
  const shoes = shares
    .map((share) => ({ share, gear: gearById.get(share.gear_id) }))
    .filter((s): s is { share: GearShare; gear: Gear } => s.gear != null);
  if (shoes.length === 0) return <>—</>;
  const [first, ...rest] = shoes;
  return (
    <span className="shoe-label">
      <ShoeDot color={first.gear.color} />
      <span className="shoe-label-name">{first.gear.name}</span>
      {rest.length > 0 && (
        <span
          className="shoe-more"
          tabIndex={0}
          aria-label={`Also ${rest.map((s) => s.gear.name).join(", ")}`}
        >
          +{rest.length}
          <span className="shoe-tip" role="tooltip">
            {shoes.map(({ share, gear }, i) => (
              <span key={i} className="shoe-tip-row">
                <ShoeDot color={gear.color} />
                <span>{gear.name}</span>
                <span className="num shoe-tip-mi">
                  {metersToMiles(share.distance_m).toFixed(1)} mi
                </span>
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
