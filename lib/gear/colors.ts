// Fixed shoe colors, in the order new shoes get them. Deliberately not the
// live accent: the Tweaks accents (violet, pink, cyan…) would collide with
// them. Avoid amber/red — those mean "near cap" / "retire soon" on the shoes
// page.
export const GEAR_PALETTE = [
  "#B18EE8",
  "#6BA8E8",
  "#F49AC1",
  "#9AD47D",
  "#7FE0B0",
  "#8EF5E8",
] as const;

export const RETIRED_GEAR_COLOR = "#6B6B75";

export interface GearColorRow {
  readonly id: string;
  readonly retired: boolean;
  readonly color: string | null;
}

/**
 * Colors for active shoes, oldest first (by id). A shoe keeps the color it
 * already has; one without a color (or whose color an older active shoe
 * holds) gets the first palette color no active shoe is using, so colors
 * freed by retired shoes are reused. Returns every active shoe's color and
 * the ones that changed, to persist.
 */
export function assignGearColors(rows: readonly GearColorRow[]): {
  colors: Map<string, string>;
  changed: Map<string, string>;
} {
  const active = rows.filter((r) => !r.retired).toSorted((a, b) => a.id.localeCompare(b.id));
  const palette: readonly string[] = GEAR_PALETTE;
  const kept = new Set<string>();
  const needs: GearColorRow[] = [];
  const colors = new Map<string, string>();

  for (const r of active) {
    if (r.color && palette.includes(r.color) && !kept.has(r.color)) {
      kept.add(r.color);
      colors.set(r.id, r.color);
    } else {
      needs.push(r);
    }
  }

  const changed = new Map<string, string>();
  for (const [i, r] of needs.entries()) {
    // More active shoes than colors: cycle through the palette.
    const color = palette.find((c) => !kept.has(c)) ?? palette[i % palette.length];
    kept.add(color);
    colors.set(r.id, color);
    changed.set(r.id, color);
  }
  return { colors, changed };
}
