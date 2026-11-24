import { addDays, formatDay, minutesOf } from "./week";
import { isStaffRole, type StaffRole } from "./roles";

/** One shift as the manager enters it, on day 0–6 of the week. */
export type Entry = {
  key: string;
  day: number;
  name: string;
  code: string; // VRP user code
  role: StaffRole | "";
  start: string; // "HH:MM" or ""
  end: string;
};

export type SaveShift = { name: string; code: string; role: StaffRole; date: string; start: string; end: string };

/** Store hours. The database enforces the same limits. */
export const OPEN_TIME = "08:00";
export const CLOSE_TIME = "21:00";

/** 15-minute choices from 8:00 AM through 9:00 PM. */
export const TIME_OPTIONS: string[] = Array.from({ length: (21 - 8) * 4 + 1 }, (_, i) => {
  const minutes = 8 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");

export const isBlankEntry = (e: Entry) => !e.name.trim() && !e.code.trim() && !e.start && !e.end;

/** VRP user codes: letters and digits, up to 20. Stored upper-case. */
export const VRP_CODE = /^[A-Za-z0-9]{1,20}$/;
export const cleanCode = (code: string) => code.trim().toUpperCase();

export type EntryField = "name" | "code" | "role" | "start" | "end";

/** Which required fields an entry is missing (blank rows are ignored). */
export function missingFields(e: Entry): EntryField[] {
  if (isBlankEntry(e)) return [];
  const out: EntryField[] = [];
  if (!cleanName(e.name)) out.push("name");
  if (!VRP_CODE.test(cleanCode(e.code))) out.push("code");
  if (!isStaffRole(e.role)) out.push("role");
  if (!e.start) out.push("start");
  if (!e.end) out.push("end");
  return out;
}

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
  const codeOf = new Map<string, string>(); // name -> code
  const nameOf = new Map<string, string>(); // code -> name

  for (const e of ordered) {
    if (isBlankEntry(e)) continue;
    const date = addDays(week, e.day);
    const { dow } = formatDay(date);
    const name = cleanName(e.name);
    if (!name) return { error: `${dow}: enter the employee's name.`, day: e.day };
    const code = cleanCode(e.code);
    if (!code) return { error: `${dow}: enter ${name}'s VRP user code.`, day: e.day };
    if (!VRP_CODE.test(code)) return { error: `${dow}: ${name}'s VRP code can only be letters and numbers.`, day: e.day };
    if (!isStaffRole(e.role)) return { error: `${dow}: pick a role for ${name}.`, day: e.day };
    if (!e.start || !e.end) return { error: `${dow}: enter a time in and a time out for ${name}.`, day: e.day };
    if (e.end <= e.start) return { error: `${dow}: ${name}'s time out is before their time in.`, day: e.day };
    const key = name.toLowerCase();
    if (codeOf.has(key) && codeOf.get(key) !== code) {
      return { error: `${dow}: ${name} has VRP code ${codeOf.get(key)} on another day but ${code} here.`, day: e.day };
    }
    if (nameOf.has(code) && nameOf.get(code) !== key) {
      return { error: `${dow}: VRP code ${code} is already used for someone else this week.`, day: e.day };
    }
    codeOf.set(key, code);
    nameOf.set(code, key);
    if (!TIME_OPTIONS.includes(e.start) || !TIME_OPTIONS.includes(e.end)) {
      return { error: `${dow}: shifts must be between 8:00 AM and 9:00 PM, in 15-minute steps.`, day: e.day };
    }
    const clash = shifts.find(
      (s) => s.date === date && s.name.toLowerCase() === name.toLowerCase() && s.start < e.end && e.start < s.end,
    );
    if (clash) return { error: `${dow}: ${name} is listed twice at overlapping times.`, day: e.day };
    shifts.push({ name, code, role: e.role, date, start: e.start, end: e.end });
  }
  return { shifts };
}
