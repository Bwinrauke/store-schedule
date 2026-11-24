import type { Employee, Shift } from "@/lib/types";
import { formatDay, formatHours, formatTime, shiftHours, todayIso, weekDays } from "@/lib/week";

/** Read-only week grid for upper management. */
export function ScheduleGrid({ week, employees, shifts }: { week: string; employees: Employee[]; shifts: Shift[] }) {
  const days = weekDays(week);
  const today = todayIso();
  const hoursOf = (s: Shift) => shiftHours(s.start_time, s.end_time, s.break_minutes);
  const sum = (list: Shift[]) => Math.round(list.reduce((t, s) => t + hoursOf(s), 0) * 100) / 100;
  const total = sum(shifts);

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left">
            <th className="sticky left-0 z-10 w-32 bg-gray-50 px-3 py-2 font-medium text-gray-600 sm:w-48">Employee</th>
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
            const mine = shifts.filter((s) => s.employee_id === e.id);
            const hours = sum(mine);
            return (
              <tr key={e.id} className="border-b border-gray-100 align-top">
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <div className="font-medium">{e.full_name}</div>
                  <div className="text-xs text-gray-500">{mine[0]?.role ?? e.role}</div>
                </td>
                {days.map((d) => (
                  <td key={d} className={`px-2 py-2 ${d === today ? "bg-brand-50/40" : ""}`}>
                    {mine.filter((s) => s.shift_date === d).map((s) => (
                      <div key={s.id} className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700 tabular">
                        {formatTime(s.start_time)}–{formatTime(s.end_time)}
                      </div>
                    ))}
                  </td>
                ))}
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
              const ds = shifts.filter((s) => s.shift_date === d);
              return (
                <td key={d} className="px-2 py-2 tabular">
                  {ds.length === 0 ? (
                    <span className="font-medium text-red-600">No one</span>
                  ) : (
                    <>
                      <div className="font-medium text-gray-900">{formatHours(sum(ds))} h</div>
                      <div className="text-xs">{new Set(ds.map((s) => s.employee_id)).size} people</div>
                    </>
                  )}
                </td>
              );
            })}
            <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular">{formatHours(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
