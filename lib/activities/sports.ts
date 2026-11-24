// Which Strava activities we keep, and which discipline each belongs to.
// Client-safe. Everyone gets runs; an athlete with a triathlon race also
// gets swims and rides (lib/strava/sync.ts decides which set applies).
//
// Strava's top-level `type` is "Run" for trail runs too (sport_type says
// "TrailRun"), so run-only queries filter on type = RUN_TYPE.

export const RUN_TYPE = "Run";

export type Sport = "swim" | "bike" | "run";

const SPORT_BY_TYPE: Record<string, Sport> = {
  Run: "run",
  TrailRun: "run",
  Swim: "swim",
  Ride: "bike",
  VirtualRide: "bike",
  EBikeRide: "bike",
};

export const RUN_TYPES = ["Run", "TrailRun"];
export const TRI_TYPES = [...RUN_TYPES, "Swim", "Ride", "VirtualRide"];

// Validated (dataviz validate_palette.js, dark, surface #141418): lightness
// band, CVD and normal-vision separation all pass in swim/bike/run order.
export const SPORT_COLORS: Record<Sport, string> = {
  swim: "#3f86d4",
  bike: "#c27a2c",
  run: "#a275e0",
};

export function sportOf(type: string | null | undefined): Sport | null {
  return (type && SPORT_BY_TYPE[type]) || null;
}

const M_PER_MILE = 1609.344;
const M_PER_YD = 0.9144;

function mmss(totalS: number): string {
  const s = Math.round(totalS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Each sport's usual speed readout: swim /100yd, bike mph, run /mi. */
export function formatSportSpeed(
  sport: Sport,
  ms: number | null | undefined,
): { value: string; unit: string } {
  if (sport === "bike") return { value: ms ? (ms * 2.236936).toFixed(1) : "—", unit: "mph" };
  if (sport === "swim") return { value: ms ? mmss((100 * M_PER_YD) / ms) : "—", unit: "/100yd" };
  return { value: ms ? mmss(M_PER_MILE / ms) : "—", unit: "/mi" };
}

/** Each sport's usual distance unit: swim yards, bike/run miles. */
export function formatSportDistance(sport: Sport, m: number): { value: string; unit: string } {
  if (sport === "swim") return { value: Math.round(m / M_PER_YD).toLocaleString("en-US"), unit: "yd" };
  return { value: (m / M_PER_MILE).toFixed(1), unit: "mi" };
}
