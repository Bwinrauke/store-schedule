/**
 * Week and time helpers. Dates are plain YYYY-MM-DD strings handled in UTC so
 * a schedule never shifts by a day because of the viewer's timezone.
 */

/** 0 = Sunday, 1 = Monday. Set NEXT_PUBLIC_WEEK_STARTS_ON to change. */
export const WEEK_STARTS_ON = Number(process.env.NEXT_PUBLIC_WEEK_STARTS_ON ?? 0) === 1 ? 1 : 0;

const DAY_MS = 86_400_000;

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(parseDate(iso).getTime() + days * DAY_MS));
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && toIso(parseDate(value)) === value;
}

/** First day of the week containing iso. */
export function weekStart(iso: string, startsOn: 0 | 1 = WEEK_STARTS_ON): string {
  const dow = parseDate(iso).getUTCDay();
  return addDays(iso, -((dow - startsOn + 7) % 7));
}

/** Today's date in the given IANA timezone, as YYYY-MM-DD. */
export function todayIso(timeZone = process.env.NEXT_PUBLIC_TIMEZONE || "America/New_York"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** Resolve a ?week= param to a week start, defaulting to the current week. */
export function resolveWeek(param: unknown): string {
  return weekStart(isIsoDate(param) ? param : todayIso());
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDay(iso: string): { dow: string; date: string } {
  const d = parseDate(iso);
  return {
    dow: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  };
}

export function formatWeekRange(start: string): string {
  const end = addDays(start, 6);
  const opts = { month: "short", day: "numeric", timeZone: "UTC" } as const;
  const year = parseDate(end).getUTCFullYear();
  return `${parseDate(start).toLocaleDateString("en-US", opts)} – ${parseDate(end).toLocaleDateString("en-US", opts)}, ${year}`;
}

/** "09:30:00" -> 570 */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "13:30:00" -> "1:30p", "09:00" -> "9a" */
export function formatTime(time: string): string {
  const total = minutesOf(time);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

/** Paid hours, net of break, matching public.shift_hours in the database. */
export function shiftHours(start: string, end: string, breakMinutes: number): number {
  const minutes = minutesOf(end) - minutesOf(start) - breakMinutes;
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0$/, "");
}
