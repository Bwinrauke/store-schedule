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

/** Half-hour choices, 5:00a through 11:30p. */
export const TIME_OPTIONS: string[] = Array.from({ length: 38 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
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
      days.push({ date: addDays(week, i), start, end });
    }
    out.push({ name, role: r.role, days });
  }
  return { rows: out };
}
