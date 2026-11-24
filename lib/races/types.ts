// Race types and distance presets. Client-safe (no server imports) so the
// Add race and plan upload dialogs share them with the server actions.

export const M_PER_MILE = 1609.344;

export type RaceType = "run" | "ironman_70_3" | "ironman";

export const RACE_TYPES: { value: RaceType; label: string }[] = [
  { value: "run", label: "Run" },
  { value: "ironman_70_3", label: "Ironman 70.3" },
  { value: "ironman", label: "Ironman" },
];

export function isRaceType(v: string): v is RaceType {
  return RACE_TYPES.some((t) => t.value === v);
}

export function isTriathlon(t: RaceType | string | null | undefined): boolean {
  return t === "ironman_70_3" || t === "ironman";
}

/** Run race distance presets (meters). */
export const RACE_DISTANCES = [
  { label: "5K", value: 5000 },
  { label: "10K", value: 10000 },
  { label: "Half marathon", value: 21097.5 },
  { label: "Marathon", value: 42195 },
  { label: "50K", value: 50000 },
  { label: "10 mile", value: 10 * M_PER_MILE },
];

export interface TriLegs {
  swim_m: number;
  bike_m: number;
  run_m: number;
}

/** Standard leg distances: 1.2 / 56 / 13.1 mi and 2.4 / 112 / 26.2 mi. */
export const TRI_LEGS: Record<"ironman_70_3" | "ironman", TriLegs> = {
  ironman_70_3: { swim_m: 1.2 * M_PER_MILE, bike_m: 56 * M_PER_MILE, run_m: 21097.5 },
  ironman: { swim_m: 2.4 * M_PER_MILE, bike_m: 112 * M_PER_MILE, run_m: 42195 },
};

/** Total distance stored on the race row (70.3 / 140.6 mi). */
export function triTotalM(t: "ironman_70_3" | "ironman"): number {
  const l = TRI_LEGS[t];
  return l.swim_m + l.bike_m + l.run_m;
}
