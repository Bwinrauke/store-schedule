import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { ScheduleDayList, ScheduleGrid } from "@/components/WeekView";
import type { Employee, Shift } from "@/lib/types";
import { formatHours, shiftHours } from "@/lib/week";

export type ShiftWithEmployee = Shift & { employees: Employee | null };

/** Read-only view of what's saved for the week, as upper management sees it. */
export function SavedWeek({
  week,
  shifts,
  submission,
}: {
  week: string;
  shifts: ShiftWithEmployee[];
  submission: { by: string; at: string } | null;
}) {
  const withEmployee = shifts.filter((s): s is Shift & { employees: Employee } => s.employees !== null);
  const employees = [...new Map(withEmployee.map((s) => [s.employee_id, s.employees])).values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
  const total =
    Math.round(withEmployee.reduce((t, s) => t + shiftHours(s.start_time, s.end_time, s.break_minutes), 0) * 100) / 100;

  if (withEmployee.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-medium">Nothing saved for this week yet</p>
        <p className="mt-1 text-sm text-gray-500">Enter the schedule and tap Save week; it will show up here.</p>
        <Link href={`?week=${week}`} className="btn btn-primary mt-4">
          Enter schedule
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
        <span>
          {submission
            ? `Saved by ${submission.by}, ${new Date(submission.at).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}`
            : "Saved"}
        </span>
        <span>
          <b className="tabular text-gray-900">{formatHours(total)} h</b> · {employees.length}{" "}
          {employees.length === 1 ? "person" : "people"}
        </span>
        <span className="no-print ml-auto">
          <PrintButton />
        </span>
      </div>
      <div className="hidden md:block print:block">
        <ScheduleGrid week={week} employees={employees} shifts={withEmployee} />
      </div>
      <div className="md:hidden print:hidden">
        <ScheduleDayList week={week} shifts={withEmployee} />
      </div>
    </div>
  );
}
