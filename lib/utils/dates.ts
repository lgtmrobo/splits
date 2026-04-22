// Date helpers. We care about local TZ (Pacific) for display but always
// store UTC in the DB. These are intentionally thin.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-04-17" → "04-17" */
export function shortMonthDay(iso: string): string {
  return iso.slice(5);
}

/** "2026-04-17T06:42:00-07:00" → "6:42 AM" */
export function formatTime12h(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "2026-04-17" → "Apr 17" */
export function formatMonthDay(iso: string): string {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "2026-04-17" → "Fri" */
export function formatDayShort(iso: string): string {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  return DAYS_SHORT[d.getDay()];
}

/** "2026-04-17" → "Apr 17 2026" */
export function formatFullDate(iso: string): string {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

/** Number of days between two ISO dates, positive if b is after a. */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a.slice(0, 10)).getTime();
  const db = new Date(b.slice(0, 10)).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

/** Convert ISO date to Monday of that week (ISO week start). */
export function startOfWeek(iso: string): string {
  const d = new Date(iso.slice(0, 10));
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Athlete's timezone. Override with APP_TIMEZONE env var. */
const APP_TZ = process.env.APP_TIMEZONE || "America/Los_Angeles";

/** Today's date in the athlete's timezone, as YYYY-MM-DD. */
export function todayLocalISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD natively
}

/** Days between two YYYY-MM-DD strings (b - a), TZ-safe. */
export function dayDiff(aISO: string, bISO: string): number {
  const a = Date.UTC(+aISO.slice(0, 4), +aISO.slice(5, 7) - 1, +aISO.slice(8, 10));
  const b = Date.UTC(+bISO.slice(0, 4), +bISO.slice(5, 7) - 1, +bISO.slice(8, 10));
  return Math.round((b - a) / 86400_000);
}

/** Add N days to a YYYY-MM-DD, returning YYYY-MM-DD. */
export function addDaysISO(iso: string, n: number): string {
  const t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400_000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Monday of the week containing the given local date (YYYY-MM-DD). */
export function mondayOfISO(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysISO(iso, diff);
}

/** Sunday (week-start) of the week containing the given local date. */
export function sundayOfISO(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 = Sun
  return addDaysISO(iso, -day);
}
