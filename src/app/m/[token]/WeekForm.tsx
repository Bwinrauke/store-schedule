"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLES, isStaffRole } from "@/lib/roles";
import { formatDay, formatHours, formatTime, parseDate, weekDays } from "@/lib/week";
import { TIME_OPTIONS, buildPayload, cleanName, entryHours, isBlankEntry, type Entry } from "@/lib/week-form";
import { saveWeek } from "./actions";

const NAME_KEY = "schedule.submittedBy";
let counter = 0;
const newKey = () => `new-${Date.now()}-${counter++}`;
const blankEntry = (day: number): Entry => ({ key: newKey(), day, name: "", role: "", start: "", end: "" });
const round = (n: number) => Math.round(n * 100) / 100;

export function WeekForm({
  token,
  storeId,
  week,
  initialEntries,
  lastWeekEntries,
  roster,
  submission,
  today,
}: {
  token: string;
  storeId: string;
  week: string;
  initialEntries: Entry[];
  lastWeekEntries: Entry[];
  roster: { name: string; role: string }[];
  submission: { by: string; at: string } | null;
  today: string;
}) {
  const router = useRouter();
  const dates = weekDays(week);
  const todayIndex = dates.indexOf(today);
  const [day, setDay] = useState(todayIndex >= 0 ? todayIndex : 0);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [dirty, setDirty] = useState(false);
  const [yourName, setYourName] = useState("");
  const [status, setStatus] = useState<{ error: string | null; message?: string } | null>(null);
  const [pending, start] = useTransition();
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

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

  const changed = (next: Entry[]) => {
    setEntries(next);
    setDirty(true);
    setStatus(null);
  };
  const update = (key: string, patch: Partial<Entry>) => changed(entries.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  const forDay = (d: number) => entries.filter((e) => e.day === d);
  const dayEntries = forDay(day);
  const dayHours = (d: number) => round(forDay(d).reduce((t, e) => t + entryHours(e), 0));
  const dayPeople = (d: number) =>
    new Set(forDay(d).filter((e) => cleanName(e.name)).map((e) => cleanName(e.name).toLowerCase())).size;
  const total = round(entries.reduce((t, e) => t + entryHours(e), 0));
  const weekIsBlank = entries.every(isBlankEntry);

  // Names to suggest: the store's roster plus anyone typed this week, with their role.
  const known = useMemo(() => {
    const map = new Map<string, { name: string; role: string }>();
    for (const p of roster) map.set(p.name.toLowerCase(), p);
    for (const e of entries) {
      if (cleanName(e.name) && e.role) map.set(cleanName(e.name).toLowerCase(), { name: cleanName(e.name), role: e.role });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [roster, entries]);

  // Weekly hours per person, so overtime is visible while filling in days.
  const perPerson = useMemo(() => {
    const map = new Map<string, { name: string; hours: number }>();
    for (const e of entries) {
      const name = cleanName(e.name);
      if (!name) continue;
      const k = name.toLowerCase();
      const cur = map.get(k) ?? { name, hours: 0 };
      cur.hours = round(cur.hours + entryHours(e));
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  }, [entries]);

  const { dow } = formatDay(dates[day]);
  const longDay = parseDate(dates[day]).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const prevDow = day > 0 ? formatDay(dates[day - 1]).dow : null;
  const nextDow = day < 6 ? formatDay(dates[day + 1]).dow : null;

  function addPerson() {
    const entry = blankEntry(day);
    setFocusKey(entry.key);
    changed([...entries, entry]);
  }

  // Switch day and bring its top into view (matters on phones, where the
  // Next button sits below the day's list).
  function goToDay(d: number) {
    setDay(d);
    const top = tabsRef.current?.getBoundingClientRect().top;
    if (top !== undefined && top < 0) tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function copyFrom(fromDay: number) {
    const copies = forDay(fromDay)
      .filter((e) => !isBlankEntry(e))
      .map((e) => ({ ...e, key: newKey(), day }));
    changed([...entries.filter((e) => !(e.day === day && isBlankEntry(e))), ...copies]);
  }

  function save() {
    try {
      localStorage.setItem(NAME_KEY, yourName.trim());
    } catch {}
    if (!yourName.trim()) {
      setStatus({ error: "Enter your name at the top, then save." });
      nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameRef.current?.focus({ preventScroll: true });
      return;
    }
    const check = buildPayload(entries, week);
    if ("error" in check) {
      goToDay(check.day);
      setStatus({ error: check.error });
      return;
    }
    start(async () => {
      const res = await saveWeek({ token, storeId, week, submittedBy: yourName, entries });
      setStatus(res);
      if (!res.error) {
        setDirty(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 pb-32">
      <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <label htmlFor="your-name" className="text-sm font-medium text-gray-700">
          Your name
        </label>
        <input
          id="your-name"
          ref={nameRef}
          className="input min-w-0 flex-1 sm:max-w-xs"
          placeholder="First and last name"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="done"
          value={yourName}
          onChange={(e) => {
            setYourName(e.target.value);
            setStatus(null);
          }}
        />
      </div>

      {submission && !dirty && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Submitted by {submission.by} on{" "}
          {new Date(submission.at).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          . You can still make changes and save again.
        </p>
      )}

      {weekIsBlank && lastWeekEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-700">Nothing entered for this week yet.</p>
          <button className="btn btn-primary" onClick={() => changed(lastWeekEntries.map((e) => ({ ...e, key: newKey() })))}>
            Start from last week
          </button>
        </div>
      )}

      {/* Day tabs */}
      <div
        ref={tabsRef}
        className="sticky top-0 z-20 -mx-4 grid scroll-mt-0 grid-cols-7 gap-1 bg-[#f6f7f9]/95 px-4 py-2 backdrop-blur sm:mx-0 sm:gap-2 sm:px-0"
        role="tablist"
        aria-label="Day"
      >
        {dates.map((d, i) => {
          const f = formatDay(d);
          const people = dayPeople(i);
          const selected = i === day;
          return (
            <button
              key={d}
              role="tab"
              aria-selected={selected}
              onClick={() => goToDay(i)}
              className={`rounded-lg border px-1 py-2 text-center ${
                selected ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-sm font-semibold">{f.dow}</div>
              <div className={`text-xs ${selected ? "text-white/80" : "text-gray-500"}`}>{f.date.replace(/^\w+ /, "")}</div>
              <div className={`mt-1 text-xs tabular ${selected ? "text-white" : people ? "text-gray-700" : "text-gray-400"}`}>
                {people ? (
                  <>
                    {people}
                    <span className="hidden sm:inline"> {people === 1 ? "person" : "people"}</span>
                    <span className="hidden sm:inline"> · {formatHours(dayHours(i))}h</span>
                  </>
                ) : (
                  "—"
                )}
              </div>
            </button>
          );
        })}
      </div>

      <datalist id="known-names">
        {known.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>

      {/* Selected day */}
      <section className="card p-4" role="tabpanel" aria-label={longDay}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{longDay}</h2>
          <span className="text-sm text-gray-600">
            {dayPeople(day)} {dayPeople(day) === 1 ? "person" : "people"} ·{" "}
            <b className="tabular">{formatHours(dayHours(day))} h</b>
          </span>
        </div>

        {dayEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-500">No one scheduled on {dow} yet.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" onClick={addPerson}>
                + Add person
              </button>
              {prevDow && forDay(day - 1).some((e) => !isBlankEntry(e)) && (
                <button className="btn" onClick={() => copyFrom(day - 1)}>
                  Copy {prevDow}&apos;s shifts
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_auto_8.5rem_8.5rem_3.5rem_2.5rem] gap-2 px-1 text-xs font-medium text-gray-500 md:grid">
              <span>Employee</span>
              <span>Role</span>
              <span>Start</span>
              <span>End</span>
              <span className="text-right">Hours</span>
              <span />
            </div>
            {dayEntries.map((e) => (
              <div
                key={e.key}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-lg border border-gray-200 p-2 md:grid-cols-[1fr_auto_8.5rem_8.5rem_3.5rem_2.5rem] md:border-0 md:p-0"
              >
                <input
                  className="input order-1 col-span-2 md:col-span-1"
                  list="known-names"
                  placeholder="Employee name"
                  aria-label="Employee name"
                  autoComplete="off"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  autoFocus={e.key === focusKey}
                  value={e.name}
                  onChange={(ev) => {
                    const name = ev.target.value;
                    const match = known.find((p) => p.name.toLowerCase() === cleanName(name).toLowerCase());
                    update(e.key, { name, role: !e.role && match && isStaffRole(match.role) ? match.role : e.role });
                  }}
                />
                <div
                  className="order-3 col-span-3 flex overflow-hidden rounded-lg border border-gray-300 md:order-2 md:col-span-1"
                  role="radiogroup"
                  aria-label="Role"
                >
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      role="radio"
                      aria-checked={e.role === role}
                      onClick={() => update(e.key, { role })}
                      className={`min-h-10 flex-1 border-l border-gray-300 px-2 text-sm whitespace-nowrap first:border-l-0 md:flex-none md:px-3 ${
                        e.role === role ? "bg-brand-500 font-medium text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <TimeSelect label="Start" className="order-4 md:order-3" value={e.start} onChange={(v) => update(e.key, { start: v })} />
                <TimeSelect label="End" className="order-5 md:order-4" value={e.end} onChange={(v) => update(e.key, { end: v })} />
                <div className="order-6 min-w-11 text-right text-sm font-semibold text-gray-900 tabular md:order-5">
                  {formatHours(round(entryHours(e)))}
                  <span className="font-normal text-gray-500 md:hidden"> h</span>
                </div>
                <button
                  type="button"
                  className="btn btn-danger order-2 min-w-11 justify-self-end px-2 md:order-6"
                  aria-label={`Remove ${e.name || "this shift"}`}
                  onClick={() => changed(entries.filter((x) => x.key !== e.key))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button className="btn w-full border-dashed" onClick={addPerson}>
              + Add person to {dow}
            </button>
          </div>
        )}

        <div className="mt-4 flex justify-between gap-2 border-t border-gray-100 pt-3">
          <button className="btn" disabled={day === 0} onClick={() => goToDay(day - 1)}>
            ← {prevDow ?? "Prev"}
          </button>
          <button className="btn btn-primary" disabled={day === 6} onClick={() => goToDay(day + 1)}>
            Next: {nextDow ?? "—"} →
          </button>
        </div>
      </section>

      {perPerson.length > 0 && (
        <section className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Hours this week</h3>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {perPerson.map((p) => (
              <li key={p.name} className="flex justify-between gap-2 border-b border-gray-50 py-0.5">
                <span>{p.name}</span>
                <span className={`tabular ${p.hours > 40 ? "font-semibold text-amber-700" : "text-gray-700"}`}>
                  {formatHours(p.hours)} h{p.hours > 40 ? " · overtime" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            {status ? (
              <p className={`text-sm leading-snug ${status.error ? "text-red-600" : "text-emerald-700"}`} role="status">
                {status.error ?? status.message}
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Week total <b className="tabular text-gray-900">{formatHours(total)} h</b>
                {dirty && <span className="ml-2 text-amber-700">· not saved</span>}
              </p>
            )}
          </div>
          <button className="btn btn-primary shrink-0 px-6" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save week"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select aria-label={label} className={`input min-w-0 ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {formatTime(t)}
        </option>
      ))}
    </select>
  );
}
