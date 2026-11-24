"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Employee, Shift } from "@/lib/types";
import { formatDay, formatHours, formatTime, shiftHours } from "@/lib/week";
import { deleteShift, saveShift } from "./actions";

export type DialogState =
  | { mode: "new"; employee: Employee; date: string }
  | { mode: "edit"; employee: Employee; shift: Shift };

const PRESETS = [
  { label: "Open", start: "09:00", end: "17:00", brk: 30 },
  { label: "Mid", start: "11:00", end: "19:00", brk: 30 },
  { label: "Close", start: "13:00", end: "21:00", brk: 30 },
  { label: "Short", start: "12:00", end: "16:00", brk: 0 },
];

export function ShiftDialog({
  storeId,
  state,
  onClose,
}: {
  storeId: string;
  state: DialogState;
  onClose: () => void;
}) {
  const router = useRouter();
  const existing = state.mode === "edit" ? state.shift : null;
  const date = existing?.shift_date ?? (state.mode === "new" ? state.date : "");

  const [start, setStart] = useState(existing?.start_time.slice(0, 5) ?? "09:00");
  const [end, setEnd] = useState(existing?.end_time.slice(0, 5) ?? "17:00");
  const [brk, setBrk] = useState(existing?.break_minutes ?? 30);
  const [position, setPosition] = useState(existing?.position ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hours = end > start ? shiftHours(start, end, brk) : 0;
  const { dow, date: dateLabel } = formatDay(date);

  function done(res: { error: string | null }) {
    if (res.error) setError(res.error);
    else {
      router.refresh();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-semibold">{existing ? "Edit shift" : "Add shift"}</h2>
        <p className="mb-4 text-sm text-gray-500">
          {state.employee.full_name} · {dow} {dateLabel}
        </p>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () =>
              done(
                await saveShift({
                  id: existing?.id,
                  store_id: storeId,
                  employee_id: state.employee.id,
                  shift_date: date,
                  start_time: start,
                  end_time: end,
                  break_minutes: brk,
                  position,
                  note,
                }),
              ),
            );
          }}
        >
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="btn px-3 py-1 text-xs"
                onClick={() => { setStart(p.start); setEnd(p.end); setBrk(p.brk); }}>
                {p.label} {formatTime(p.start)}–{formatTime(p.end)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="start">Start</label>
              <input id="start" type="time" step={900} required className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="end">End</label>
              <input id="end" type="time" step={900} required className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="brk">Break (min)</label>
              <input id="brk" type="number" min={0} max={240} step={5} className="input" value={brk} onChange={(e) => setBrk(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="pos">Role (optional)</label>
              <input id="pos" className="input" placeholder={state.employee.position} value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="note">Note (optional)</label>
              <input id="note" className="input" placeholder="e.g. truck day" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Paid hours: <b className="tabular">{formatHours(hours)}</b>
          </p>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            {existing && (
              <button type="button" className="btn btn-danger" disabled={pending}
                onClick={() => {
                  if (!confirm("Delete this shift?")) return;
                  startTransition(async () => done(await deleteShift(existing.id)));
                }}>
                Delete
              </button>
            )}
            <button type="button" className="btn ml-auto" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
