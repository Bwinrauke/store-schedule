import { addDays } from "./week";
import { isStaffRole, type StaffRole } from "./roles";

/** One employee's week as the manager edits it. Empty start/end = off. */
export type FormRow = {
  key: string;
  name: string;
  role: StaffRole | "";
  days: { start: string; end: string }[]; // 7 entries, "HH:MM" or ""
};

export type SavePayloadRow = {
  name: string;
  role: StaffRole;
  days: { date: string; start: string; end: string }[];
};

export const emptyDays = () => Array.from({ length: 7 }, () => ({ start: "", end: "" }));

/** Store hours. The database enforces the same limits. */
export const OPEN_TIME = "08:00";
export const CLOSE_TIME = "21:00";

/** 15-minute choices from 8:00 AM through 9:00 PM. */
export const TIME_OPTIONS: string[] = Array.from({ length: (21 - 8) * 4 + 1 }, (_, i) => {
  const minutes = 8 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/**
 * Check the form and turn it into what save_week expects. Returns the first
 * problem in plain words, so the manager knows exactly what to fix.
 */
export function buildPayload(rows: FormRow[], week: string): { rows: SavePayloadRow[] } | { error: string } {
  const out: SavePayloadRow[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const name = r.name.trim().replace(/\s+/g, " ");
    const hasTimes = r.days.some((d) => d.start || d.end);
    if (!name) {
      if (hasTimes) return { error: "A row has hours but no employee name." };
      continue;
    }
    if (!isStaffRole(r.role)) return { error: `Pick a role for ${name}.` };
    const lower = name.toLowerCase();
    if (seen.has(lower)) return { error: `${name} is listed twice.` };
    seen.add(lower);

    const days: SavePayloadRow["days"] = [];
    for (let i = 0; i < 7; i++) {
      const { start, end } = r.days[i] ?? { start: "", end: "" };
      if (!start && !end) continue;
      if (!start || !end) return { error: `${name}: set both a start and an end time, or mark the day off.` };
      if (end <= start) return { error: `${name}: a shift ends before it starts.` };
      if (!TIME_OPTIONS.includes(start) || !TIME_OPTIONS.includes(end)) {
        return { error: `${name}: shifts must be between 8:00 AM and 9:00 PM, in 15-minute steps.` };
      }
      days.push({ date: addDays(week, i), start, end });
    }
    out.push({ name, role: r.role, days });
  }
  return { rows: out };
}
