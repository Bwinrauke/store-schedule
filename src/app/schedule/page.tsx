import { Shell } from "@/components/Shell";
import { WeekToolbar } from "@/components/WeekToolbar";
import { createClient } from "@/lib/supabase/server";
import { getMyStores, requireExecutive } from "@/lib/session";
import type { Employee, Shift } from "@/lib/types";
import { addDays, resolveWeek } from "@/lib/week";
import { ScheduleDayList, ScheduleGrid } from "./ScheduleGrid";
import { PrintButton } from "./PrintButton";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ store?: string; week?: string }> }) {
  await requireExecutive();
  const params = await searchParams;
  const week = resolveWeek(params.week);
  const stores = await getMyStores();

  if (stores.length === 0) {
    return (
      <Shell>
        <div className="card p-8 text-center text-sm text-gray-500">No stores yet. Add them in Admin.</div>
      </Shell>
    );
  }

  const store = stores.find((s) => s.id === params.store) ?? stores[0];
  const supabase = await createClient();
  const [{ data: shifts }, { data: submission }] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, store_id, employee_id, shift_date, start_time, end_time, break_minutes, role, note, employees(id, store_id, full_name, role, active)")
      .eq("store_id", store.id)
      .gte("shift_date", week)
      .lte("shift_date", addDays(week, 6))
      .order("start_time"),
    supabase.from("week_submissions").select("submitted_by, submitted_at").eq("store_id", store.id).eq("week_start", week).maybeSingle(),
  ]);

  const rows = (shifts ?? []) as unknown as (Shift & { employees: Employee })[];
  const employees = [...new Map(rows.map((s) => [s.employee_id, s.employees])).values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );

  return (
    <Shell>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold">
          {store.code ? `#${store.code} · ` : ""}
          {store.name}
        </h1>
        <span className="text-sm text-gray-500">
          {submission
            ? `Submitted by ${submission.submitted_by}, ${new Date(submission.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : "Not submitted yet"}
        </span>
      </div>
      <WeekToolbar week={week} stores={stores} storeId={store.id}>
        <a className="btn" href={`/api/export?week=${week}&store=${store.id}`}>Export CSV</a>
        <PrintButton />
      </WeekToolbar>
      {employees.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">Nothing scheduled for this store this week.</div>
      ) : (
        <>
          <div className="hidden md:block print:block">
            <ScheduleGrid week={week} employees={employees} shifts={rows} />
          </div>
          <div className="md:hidden print:hidden">
            <ScheduleDayList week={week} shifts={rows} />
          </div>
        </>
      )}
    </Shell>
  );
}
