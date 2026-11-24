"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLES, isStaffRole } from "@/lib/roles";
import { formatDay, formatHours, formatTime, shiftHours, weekDays } from "@/lib/week";
import { TIME_OPTIONS, emptyDays, type FormRow } from "@/lib/week-form";
import { saveWeek } from "./actions";

const NAME_KEY = "schedule.submittedBy";
let counter = 0;
const newKey = () => `new-${Date.now()}-${counter++}`;
const blankRow = (): FormRow => ({ key: newKey(), name: "", role: "", days: emptyDays() });

export function WeekForm({
  token,
  storeId,
  week,
  initialRows,
  lastWeekRows,
  roster,
  submission,
}: {
  token: string;
  storeId: string;
  week: string;
  initialRows: FormRow[];
  lastWeekRows: FormRow[];
  roster: { name: string; role: string }[];
  submission: { by: string; at: string } | null;
}) {
  const router = useRouter();
  const days = weekDays(week);
  const [rows, setRows] = useState<FormRow[]>(initialRows.length ? initialRows : [blankRow()]);
  const [dirty, setDirty] = useState(false);
  const [yourName, setYourName] = useState("");
  const [status, setStatus] = useState<{ error: string | null; message?: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      setYourName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {}
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (key: string, change: (r: FormRow) => FormRow) => {
    setRows((rs) => rs.map((r) => (r.key === key ? change(r) : r)));
    setDirty(true);
    setStatus(null);
  };

  const setDay = (key: string, i: number, field: "start" | "end", value: string) =>
    update(key, (r) => ({ ...r, days: r.days.map((d, j) => (j === i ? { ...d, [field]: value } : d)) }));

  const rowHours = (r: FormRow) =>
    r.days.reduce((t, d) => (d.start && d.end && d.end > d.start ? t + shiftHours(d.start, d.end, 0) : t), 0);
  const total = rows.reduce((t, r) => t + rowHours(r), 0);
  const isBlank = rows.every((r) => !r.name.trim() && r.days.every((d) => !d.start && !d.end));

  function save() {
    try {
      localStorage.setItem(NAME_KEY, yourName.trim());
    } catch {}
    start(async () => {
      const res = await saveWeek({ token, storeId, week, submittedBy: yourName, rows });
      setStatus(res);
      if (!res.error) {
        setDirty(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 pb-28">
      {submission && !dirty && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Submitted by {submission.by} on{" "}
          {new Date(submission.at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          You can still make changes and save again.
        </p>
      )}

      {isBlank && lastWeekRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-700">Nothing entered for this week yet.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setRows(lastWeekRows.map((r) => ({ ...r, key: newKey() })));
              setDirty(true);
            }}
          >
            Start from last week
          </button>
        </div>
      )}

      <datalist id="roster">
        {roster.map((p) => <option key={p.name} value={p.name} />)}
      </datalist>

      {rows.map((r, idx) => (
        <section key={r.key} className="card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor={`name-${r.key}`}>Employee {idx + 1}</label>
              <input
                id={`name-${r.key}`}
                className="input"
                list="roster"
                placeholder="Full name"
                autoComplete="off"
                value={r.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const known = roster.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
                  update(r.key, (row) => ({
                    ...row,
                    name,
                    role: !row.role && known && isStaffRole(known.role) ? known.role : row.role,
                  }));
                }}
              />
            </div>
            <div>
              <span className="label">Role</span>
              <div className="flex overflow-hidden rounded-lg border border-gray-300" role="radiogroup" aria-label="Role">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    role="radio"
                    aria-checked={r.role === role}
                    onClick={() => update(r.key, (row) => ({ ...row, role }))}
                    className={`min-h-10 border-l border-gray-300 px-3 text-sm first:border-l-0 ${
                      r.role === role ? "bg-brand-500 font-medium text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-right">
              <span className="label">Hours</span>
              <div className="min-h-10 text-xl leading-10 font-semibold tabular">{formatHours(rowHours(r))}</div>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              aria-label={`Remove employee ${idx + 1}`}
              onClick={() => {
                if ((r.name || rowHours(r) > 0) && !confirm(`Remove ${r.name || "this row"} from this week?`)) return;
                setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((x) => x.key !== r.key)));
                setDirty(true);
              }}
            >
              Remove
            </button>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-7">
            {days.map((d, i) => {
              const { dow, date } = formatDay(d);
              const day = r.days[i];
              const off = !day.start && !day.end;
              return (
                <div key={d} className={`flex items-center gap-2 rounded-lg border p-2 md:flex-col md:items-stretch ${off ? "border-gray-200 bg-gray-50" : "border-brand-100 bg-brand-50/50"}`}>
                  <div className="w-24 shrink-0 text-sm whitespace-nowrap md:w-auto">
                    <span className="font-medium">{dow}</span> <span className="text-gray-500">{date}</span>
                  </div>
                  <TimeSelect label={`${dow} start`} value={day.start} placeholder="Off" onChange={(v) => setDay(r.key, i, "start", v)} />
                  <span className="text-gray-400 md:hidden">–</span>
                  <TimeSelect label={`${dow} end`} value={day.end} placeholder={off ? "Off" : "End"} onChange={(v) => setDay(r.key, i, "end", v)} />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <button type="button" className="btn w-full border-dashed py-3" onClick={() => setRows((rs) => [...rs, blankRow()])}>
        + Add employee
      </button>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <input
            className="input w-full sm:w-56"
            placeholder="Your name"
            aria-label="Your name"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
          />
          <div className="text-sm text-gray-600">
            Week total <b className="tabular text-gray-900">{formatHours(Math.round(total * 100) / 100)} h</b>
          </div>
          {status && (
            <p className={`text-sm ${status.error ? "text-red-600" : "text-emerald-700"}`} role="status">
              {status.error ?? status.message}
            </p>
          )}
          <button className="btn btn-primary ml-auto px-6" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save week"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeSelect({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <select aria-label={label} className="input min-h-9 flex-1 px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>{formatTime(t)}</option>
      ))}
    </select>
  );
}
