"use client";

import { useMemo, useState } from "react";
import type { Employee, Shift } from "@/lib/types";
import { formatDay, formatHours, formatTime, shiftHours, todayIso, weekDays } from "@/lib/week";
import { ShiftDialog, type DialogState } from "./ShiftDialog";

export function ScheduleGrid({
  storeId,
  week,
  employees,
  shifts,
}: {
  storeId: string;
  week: string;
  employees: Employee[];
  shifts: Shift[];
}) {
  const days = weekDays(week);
  const today = todayIso();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const byCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.employee_id}|${s.shift_date}`;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [shifts]);

  const hoursOf = (s: Shift) => shiftHours(s.start_time, s.end_time, s.break_minutes);
  const employeeHours = (id: string) =>
    shifts.filter((s) => s.employee_id === id).reduce((t, s) => t + hoursOf(s), 0);
  const dayShifts = (d: string) => shifts.filter((s) => s.shift_date === d);
  const totalHours = shifts.reduce((t, s) => t + hoursOf(s), 0);

  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Scheduled hours" value={formatHours(Math.round(totalHours * 100) / 100)} />
        <Stat label="Shifts" value={String(shifts.length)} />
        <Stat label="People" value={`${new Set(shifts.map((s) => s.employee_id)).size}/${employees.filter((e) => e.active).length}`} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="sticky left-0 z-10 w-32 bg-gray-50 sm:w-48 px-3 py-2 font-medium text-gray-600">Employee</th>
              {days.map((d) => {
                const { dow, date } = formatDay(d);
                return (
                  <th key={d} className={`px-2 py-2 font-medium ${d === today ? "text-brand-700" : "text-gray-600"}`}>
                    <div>{dow}</div>
                    <div className="text-xs font-normal">{date}</div>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right font-medium text-gray-600">Hours</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const hours = employeeHours(e.id);
              return (
                <tr key={e.id} className="border-b border-gray-100 align-top">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <div className="font-medium">{e.full_name}</div>
                    <div className="text-xs text-gray-500">
                      {e.position}
                      {!e.active && " · inactive"}
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = byCell.get(`${e.id}|${d}`) ?? [];
                    return (
                      <td key={d} className={`px-1 py-1 ${d === today ? "bg-brand-50/40" : ""}`}>
                        <div className="flex min-h-12 flex-col gap-1">
                          {cell.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => setDialog({ mode: "edit", shift: s, employee: e })}
                              className="rounded-md border border-brand-100 bg-brand-50 px-2 py-1 text-left hover:border-brand-500"
                              title={s.note ?? undefined}
                            >
                              <div className="font-medium text-brand-700 tabular">
                                {formatTime(s.start_time)}–{formatTime(s.end_time)}
                              </div>
                              {(s.position || s.note) && (
                                <div className="truncate text-xs text-gray-600">{s.position ?? s.note}</div>
                              )}
                            </button>
                          ))}
                          {e.active && (
                            <button
                              onClick={() => setDialog({ mode: "new", employee: e, date: d })}
                              className="no-print flex-1 rounded-md border border-dashed border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-600"
                              aria-label={`Add shift for ${e.full_name} on ${d}`}
                            >
                              {cell.length === 0 ? "+" : ""}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className={`px-3 py-2 text-right font-medium tabular ${hours > 40 ? "text-amber-700" : ""}`}>
                    {formatHours(hours)}
                    {hours > 40 && <div className="text-xs font-normal">overtime</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 text-gray-600">
              <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-medium">Daily total</td>
              {days.map((d) => {
                const ds = dayShifts(d);
                return (
                  <td key={d} className="px-2 py-2 tabular">
                    {ds.length === 0 ? (
                      <span className="font-medium text-red-600">No one</span>
                    ) : (
                      <>
                        <div className="font-medium text-gray-900">{formatHours(ds.reduce((t, s) => t + hoursOf(s), 0))} h</div>
                        <div className="text-xs">{new Set(ds.map((s) => s.employee_id)).size} people</div>
                      </>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular">{formatHours(Math.round(totalHours * 100) / 100)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="no-print mt-2 text-xs text-gray-500">Click an empty cell to add a shift, or a shift to change it.</p>

      {dialog && <ShiftDialog storeId={storeId} state={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold tabular">{value}</div>
    </div>
  );
}
