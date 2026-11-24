import { addDays, formatDay, minutesOf } from "./week";
import { isStaffRole, type StaffRole } from "./roles";

/** One shift as the manager enters it, on day 0–6 of the week. */
export type Entry = {
  key: string;
  day: number;
  name: string;
  role: StaffRole | "";
  start: string; // "HH:MM" or ""
  end: string;
};

export type SaveShift = { name: string; role: StaffRole; date: string; start: string; end: string };

/** Store hours. The database enforces the same limits. */
export const OPEN_TIME = "08:00";
export const CLOSE_TIME = "21:00";

/** 15-minute choices from 8:00 AM through 9:00 PM. */
export const TIME_OPTIONS: string[] = Array.from({ length: (21 - 8) * 4 + 1 }, (_, i) => {
  const minutes = 8 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");

export const isBlankEntry = (e: Entry) => !e.name.trim() && !e.start && !e.end;

/** Paid hours for an entry, or 0 while it's incomplete. */
export function entryHours(e: Entry): number {
  if (!e.start || !e.end || e.end <= e.start) return 0;
  return (minutesOf(e.end) - minutesOf(e.start)) / 60;
}

/**
 * Check the form and turn it into what save_week expects. Returns the first
 * problem in plain words, naming the day, so the manager knows what to fix.
 */
export function buildPayload(
  entries: Entry[],
  week: string,
): { shifts: SaveShift[] } | { error: string; day: number } {
  const shifts: SaveShift[] = [];
  const ordered = [...entries].sort((a, b) => a.day - b.day);

  for (const e of ordered) {
    if (isBlankEntry(e)) continue;
    const date = addDays(week, e.day);
    const { dow } = formatDay(date);
    const name = cleanName(e.name);
    if (!name) return { error: `${dow}: a shift has times but no employee name.`, day: e.day };
    if (!isStaffRole(e.role)) return { error: `${dow}: pick a role for ${name}.`, day: e.day };
    if (!e.start || !e.end) return { error: `${dow}: set both a start and an end time for ${name}.`, day: e.day };
    if (e.end <= e.start) return { error: `${dow}: ${name}'s shift ends before it starts.`, day: e.day };
    if (!TIME_OPTIONS.includes(e.start) || !TIME_OPTIONS.includes(e.end)) {
      return { error: `${dow}: shifts must be between 8:00 AM and 9:00 PM, in 15-minute steps.`, day: e.day };
    }
    const clash = shifts.find(
      (s) => s.date === date && s.name.toLowerCase() === name.toLowerCase() && s.start < e.end && e.start < s.end,
    );
    if (clash) return { error: `${dow}: ${name} is listed twice at overlapping times.`, day: e.day };
    shifts.push({ name, role: e.role, date, start: e.start, end: e.end });
  }
  return { shifts };
}
