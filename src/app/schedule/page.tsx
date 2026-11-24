import Link from "next/link";
import { Shell } from "@/components/Shell";
import { WeekToolbar } from "@/components/WeekToolbar";
import { createClient } from "@/lib/supabase/server";
import { getMyStores } from "@/lib/session";
import type { Employee, Shift } from "@/lib/types";
import { addDays, resolveWeek } from "@/lib/week";
import { ScheduleGrid } from "./ScheduleGrid";
import { CopyWeekButton } from "./CopyWeekButton";
import { PrintButton } from "./PrintButton";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; week?: string }>;
}) {
  const params = await searchParams;
  const week = resolveWeek(params.week);
  const stores = await getMyStores();

  if (stores.length === 0) {
    return (
      <Shell>
        <div className="card p-8 text-center">
          <p className="font-medium">No stores assigned yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Ask upper management to add you to your store in the Admin page.
          </p>
        </div>
      </Shell>
    );
  }

  const store = stores.find((s) => s.id === params.store) ?? stores[0];
  const supabase = await createClient();
  const [{ data: employees }, { data: shifts }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, store_id, full_name, position, phone, active")
      .eq("store_id", store.id)
      .order("full_name"),
    supabase
      .from("shifts")
      .select("id, store_id, employee_id, shift_date, start_time, end_time, break_minutes, position, note")
      .eq("store_id", store.id)
      .gte("shift_date", week)
      .lte("shift_date", addDays(week, 6))
      .order("start_time"),
  ]);

  const weekShifts = (shifts ?? []) as Shift[];
  const scheduledIds = new Set(weekShifts.map((s) => s.employee_id));
  // Show active staff, plus anyone since deactivated who still has shifts this week.
  const roster = ((employees ?? []) as Employee[]).filter((e) => e.active || scheduledIds.has(e.id));

  return (
    <Shell>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold">{store.name}</h1>
        <span className="text-sm text-gray-500">Weekly schedule</span>
      </div>
      <WeekToolbar week={week} stores={stores} storeId={store.id}>
        <CopyWeekButton storeId={store.id} week={week} />
        <a className="btn" href={`/api/export?week=${week}&store=${store.id}`}>
          Export CSV
        </a>
        <PrintButton />
      </WeekToolbar>

      {roster.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium">No employees yet</p>
          <p className="mt-1 text-sm text-gray-500">Add your team first, then build the week.</p>
          <Link href={`/employees?store=${store.id}`} className="btn btn-primary mt-4">
            Add employees
          </Link>
        </div>
      ) : (
        <ScheduleGrid storeId={store.id} week={week} employees={roster} shifts={weekShifts} />
      )}
    </Shell>
  );
}
