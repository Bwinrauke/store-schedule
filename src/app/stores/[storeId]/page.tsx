import Link from "next/link";
import { notFound } from "next/navigation";
import { WeekToolbar } from "@/components/WeekToolbar";
import { createServiceClient } from "@/lib/supabase/admin";
import { isStaffRole } from "@/lib/roles";
import { hasStoreAccess, storeHasPin } from "@/lib/storeAccess";
import type { Employee, Shift, Store } from "@/lib/types";
import { addDays, resolveWeek, todayIso } from "@/lib/week";
import type { Entry } from "@/lib/week-form";
import { ManagerHeader } from "../ManagerHeader";
import { LeaveStoreButton } from "./LeaveStoreButton";
import { PinForm } from "./PinForm";
import { SavedWeek, type ShiftWithEmployee } from "./SavedWeek";
import { ViewTabs } from "./ViewTabs";
import { WeekForm } from "./WeekForm";

export const metadata = { title: "Weekly Schedule", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ShiftWithName = Shift & { employees: Employee | null };

function toEntries(shifts: ShiftWithName[], week: string): Entry[] {
  return shifts
    .map((s) => ({
      key: s.id,
      day: Math.round((Date.parse(s.shift_date) - Date.parse(week)) / 86_400_000),
      name: s.employees?.full_name ?? "",
      code: s.employees?.vrp_code ?? "",
      role: isStaffRole(s.role) ? s.role : ("" as const),
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
    }))
    .filter((e) => e.day >= 0 && e.day < 7)
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

export default async function StoreWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ week?: string; view?: string }>;
}) {
  const { storeId } = await params;
  if (!UUID.test(storeId)) notFound();

  const db = createServiceClient();
  const { data: storeRow } = await db
    .from("stores")
    .select("id, name, code, region, active")
    .eq("id", storeId)
    .eq("active", true)
    .maybeSingle();
  if (!storeRow) notFound();
  const store = storeRow as Store;
  const title = `${store.code ? `#${store.code} · ` : ""}${store.name}`;

  if (!(await hasStoreAccess(store.id))) {
    const hasPin = await storeHasPin(store.id);
    return (
      <div className="min-h-dvh">
        <ManagerHeader />
        <main className="mx-auto max-w-sm px-4 py-8">
          <h1 className="mb-1 text-center text-xl font-semibold">{title}</h1>
          <p className="mb-5 text-center text-sm">
            <Link href="/stores" className="text-brand-600 hover:underline">Not your store?</Link>
          </p>
          {hasPin ? (
            <PinForm storeId={store.id} />
          ) : (
            <div className="card p-6 text-center text-sm text-gray-600">
              This store doesn&apos;t have a PIN yet. Ask upper management to set one in Admin.
            </div>
          )}
        </main>
      </div>
    );
  }

  const sp = await searchParams;
  const week = resolveWeek(sp.week);
  const view = sp.view === "saved" ? "saved" : "edit";
  const shiftCols =
    "id, store_id, employee_id, shift_date, start_time, end_time, break_minutes, role, note, employees(id, store_id, full_name, role, vrp_code, active)";
  const [{ data: thisWeek }, { data: lastWeek }, { data: roster }, { data: submission }] = await Promise.all([
    db.from("shifts").select(shiftCols).eq("store_id", store.id).gte("shift_date", week).lte("shift_date", addDays(week, 6)),
    db.from("shifts").select(shiftCols).eq("store_id", store.id).gte("shift_date", addDays(week, -7)).lte("shift_date", addDays(week, -1)),
    db.from("employees").select("full_name, role, vrp_code").eq("store_id", store.id).eq("active", true).order("full_name"),
    db.from("week_submissions").select("submitted_by, submitted_at").eq("store_id", store.id).eq("week_start", week).maybeSingle(),
  ]);

  return (
    <div className="min-h-dvh">
      <ManagerHeader>
        <LeaveStoreButton storeId={store.id} />
      </ManagerHeader>
      <main className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold">{title}</h1>
          <Link href="/stores" className="text-sm text-brand-600 hover:underline">Change store</Link>
        </div>
        <WeekToolbar week={week} />
        <ViewTabs week={week} active={view} />
        {view === "saved" ? (
          <SavedWeek
            week={week}
            shifts={(thisWeek ?? []) as unknown as ShiftWithEmployee[]}
            submission={submission ? { by: submission.submitted_by as string, at: submission.submitted_at as string } : null}
          />
        ) : (
          <WeekForm
            key={`${store.id}|${week}`}
            storeId={store.id}
            week={week}
            initialEntries={toEntries((thisWeek ?? []) as unknown as ShiftWithName[], week)}
            lastWeekEntries={toEntries((lastWeek ?? []) as unknown as ShiftWithName[], addDays(week, -7))}
            roster={(roster ?? []).map((r) => ({ name: r.full_name as string, role: r.role as string, code: (r.vrp_code as string | null) ?? "" }))}
            submission={submission ? { by: submission.submitted_by as string, at: submission.submitted_at as string } : null}
            today={todayIso()}
          />
        )}
      </main>
    </div>
  );
}
