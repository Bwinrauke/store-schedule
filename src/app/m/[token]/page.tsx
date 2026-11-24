import { notFound } from "next/navigation";
import { WeekToolbar } from "@/components/WeekToolbar";
import { createServiceClient } from "@/lib/supabase/admin";
import { isValidManagerToken } from "@/lib/managerLink";
import { isStaffRole } from "@/lib/roles";
import type { Shift, Store } from "@/lib/types";
import { addDays, resolveWeek, todayIso } from "@/lib/week";
import type { Entry } from "@/lib/week-form";
import { StorePicker } from "./StorePicker";
import { WeekForm } from "./WeekForm";

export const metadata = { title: "Weekly Schedule", robots: { index: false, follow: false } };

type ShiftWithName = Shift & { employees: { full_name: string } | null };

function toEntries(shifts: ShiftWithName[], week: string): Entry[] {
  return shifts
    .map((s) => ({
      key: s.id,
      day: Math.round((Date.parse(s.shift_date) - Date.parse(week)) / 86_400_000),
      name: s.employees?.full_name ?? "",
      role: isStaffRole(s.role) ? s.role : ("" as const),
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
    }))
    .filter((e) => e.day >= 0 && e.day < 7)
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

export default async function ManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ store?: string; week?: string }>;
}) {
  const { token } = await params;
  if (!(await isValidManagerToken(token))) notFound();

  const sp = await searchParams;
  const week = resolveWeek(sp.week);
  const db = createServiceClient();
  const { data: storeData } = await db
    .from("stores")
    .select("id, name, code, region, active")
    .eq("active", true)
    .order("code", { nullsFirst: false })
    .order("name");
  const stores = (storeData ?? []) as Store[];
  const store = stores.find((s) => s.id === sp.store);

  const header = (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 font-semibold">Weekly Schedule</div>
    </header>
  );

  if (!store) {
    return (
      <div className="min-h-screen">
        {header}
        <main className="mx-auto max-w-md px-4 py-10">
          <StorePicker stores={stores} />
        </main>
      </div>
    );
  }

  const shiftCols = "id, store_id, employee_id, shift_date, start_time, end_time, break_minutes, role, note, employees(full_name)";
  const [{ data: thisWeek }, { data: lastWeek }, { data: roster }, { data: submission }] = await Promise.all([
    db.from("shifts").select(shiftCols).eq("store_id", store.id).gte("shift_date", week).lte("shift_date", addDays(week, 6)),
    db.from("shifts").select(shiftCols).eq("store_id", store.id).gte("shift_date", addDays(week, -7)).lte("shift_date", addDays(week, -1)),
    db.from("employees").select("full_name, role").eq("store_id", store.id).eq("active", true).order("full_name"),
    db.from("week_submissions").select("submitted_by, submitted_at").eq("store_id", store.id).eq("week_start", week).maybeSingle(),
  ]);

  return (
    <div className="min-h-screen">
      {header}
      <main className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold">
            {store.code ? `#${store.code} · ` : ""}
            {store.name}
          </h1>
          <a href="?" className="text-sm text-brand-600 hover:underline">Change store</a>
        </div>
        <WeekToolbar week={week} />
        <WeekForm
          key={`${store.id}|${week}`}
          token={token}
          storeId={store.id}
          week={week}
          initialEntries={toEntries((thisWeek ?? []) as unknown as ShiftWithName[], week)}
          lastWeekEntries={toEntries((lastWeek ?? []) as unknown as ShiftWithName[], addDays(week, -7))}
          today={todayIso()}
          roster={(roster ?? []).map((r) => ({ name: r.full_name as string, role: r.role as string }))}
          submission={submission ? { by: submission.submitted_by as string, at: submission.submitted_at as string } : null}
        />
      </main>
    </div>
  );
}
