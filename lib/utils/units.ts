// All DB values are in SI (meters, m/s, seconds). Display helpers here.
// Units are currently hardcoded to US (miles, min/mi, feet). If we ever
// add user-level unit prefs, route them through here.

const M_PER_MILE = 1609.344;
const M_PER_KM = 1000;
const M_PER_FT = 0.3048;

export function metersToMiles(m: number): number {
  return m / M_PER_MILE;
}

export function metersToKm(m: number): number {
  return m / M_PER_KM;
}

export function metersToFeet(m: number): number {
  return m / M_PER_FT;
}

/** Distance in miles, rounded to 1 decimal. */
export function formatMiles(m: number | null | undefined, decimals = 1): string {
  if (m == null) return "—";
  return metersToMiles(m).toFixed(decimals);
}

/** Compact miles: "1.5", "7", "10.5" — 1 decimal, trailing .0 stripped. */
export function formatMilesCompact(mi: number): string {
  const rounded = Math.round(mi * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Elevation gain in feet, integer. */
export function formatFeet(m: number | null | undefined): string {
  if (m == null) return "—";
  return Math.round(metersToFeet(m)).toLocaleString();
}

/** Pace from m/s → "M:SS" per mile. */
export function speedToPacePerMile(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "—";
  const secPerMile = M_PER_MILE / ms;
  const min = Math.floor(secPerMile / 60);
  const sec = Math.round(secPerMile % 60);
  if (sec === 60) return `${min + 1}:00`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/** Seconds → "M:SS" or "H:MM:SS" if >= 1h. */
export function formatDuration(s: number | null | undefined): string {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Total duration, no seconds: "5h 42m" */
export function formatDurationShort(s: number | null | undefined): string {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Pace as decimal minutes per mile (e.g. 7.05 = 7:03/mi) for charting. */
export function speedToDecimalPacePerMile(ms: number | null | undefined): number | null {
  if (!ms || ms <= 0) return null;
  const secPerMile = M_PER_MILE / ms;
  return secPerMile / 60;
}

/** "8:14" (min/mi) → decimal minutes (8.233...) for chart axes. */
export function parsePaceToDecimal(pace: string): number {
  const [m, s] = pace.split(":").map(Number);
  return m + (s || 0) / 60;
}

/** Miles → meters (for inputs / planned distances when user types miles). */
export function milesToMeters(mi: number): number {
  return mi * M_PER_MILE;
}

/** "M:SS /mi" → seconds per km (planned_runs uses s/km canonically). */
export function pacePerMileToSecPerKm(pace: string): number {
  const [m, s] = pace.split(":").map(Number);
  const secPerMile = m * 60 + (s || 0);
  return secPerMile / (M_PER_MILE / M_PER_KM);
}

/** seconds/km → "M:SS /mi" for display. */
export function secPerKmToPacePerMile(sPerKm: number): string {
  const secPerMile = sPerKm * (M_PER_MILE / M_PER_KM);
  const min = Math.floor(secPerMile / 60);
  const sec = Math.round(secPerMile % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export { M_PER_MILE, M_PER_KM, M_PER_FT };
