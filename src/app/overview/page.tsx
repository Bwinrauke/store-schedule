import Link from "next/link";
import { Shell } from "@/components/Shell";
import { WeekToolbar } from "@/components/WeekToolbar";
import { createClient } from "@/lib/supabase/server";
import { requireExecutive } from "@/lib/session";
import type { WeekSummaryRow } from "@/lib/types";
import { addDays, formatHours, formatTime, resolveWeek, todayIso } from "@/lib/week";

const n = (v: unknown) => Number(v ?? 0);
const h = (v: unknown) => formatHours(Math.round(n(v) * 100) / 100);

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  await requireExecutive();
  const params = await searchParams;
  const week = resolveWeek(params.week);
  const today = todayIso();
  const supabase = await createClient();

  const [{ data: summary }, { data: prior }, { data: todayShifts }] = await Promise.all([
    supabase.rpc("week_summary", { week_start: week }),
    supabase.rpc("week_summary", { week_start: addDays(week, -7) }),
    supabase
      .from("shift_details")
      .select("store_code, store_name, employee_name, role, start_time, end_time")
      .eq("shift_date", today)
      .order("store_name")
      .order("start_time"),
  ]);

  const rows = (summary ?? []) as WeekSummaryRow[];
  const priorHours = new Map(((prior ?? []) as WeekSummaryRow[]).map((r) => [r.store_id, n(r.total_hours)]));
  const sumOf = (k: keyof WeekSummaryRow) => rows.reduce((t, r) => t + n(r[k]), 0);
  const missing = rows.filter((r) => !r.submitted_by);
  const isThisWeek = today >= week && today <= addDays(week, 6);

  const todayByStore = new Map<string, NonNullable<typeof todayShifts>>();
  for (const s of todayShifts ?? []) {
    const label = s.store_code ? `#${s.store_code} · ${s.store_name}` : s.store_name;
    todayByStore.set(label, [...(todayByStore.get(label) ?? []), s]);
  }

  return (
    <Shell>
      <h1 className="mb-3 text-xl font-semibold">All stores</h1>
      <WeekToolbar week={week}>
        <a className="btn" href={`/api/export?week=${week}`}>Export all (CSV)</a>
      </WeekToolbar>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Total hours" value={h(sumOf("total_hours"))} />
        <Kpi label="Cashier" value={h(sumOf("cashier_hours"))} />
        <Kpi label="Sales Associate" value={h(sumOf("sales_hours"))} />
        <Kpi label="Keyholder" value={h(sumOf("keyholder_hours"))} />
        <Kpi label="Not submitted" value={`${missing.length} of ${rows.length}`} tone={missing.length ? "bad" : "ok"} />
      </div>

      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Store</th>
              <th className="px-4 py-2 font-medium">Submitted</th>
              <th className="px-3 py-2 text-right font-medium">Cashier</th>
              <th className="px-3 py-2 text-right font-medium">Sales</th>
              <th className="px-3 py-2 text-right font-medium">Keyholder</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">vs last wk</th>
              <th className="px-3 py-2 text-right font-medium">People</th>
              <th className="px-4 py-2 font-medium">Coverage</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500">No stores yet. Add them in Admin.</td></tr>
            )}
            {rows.map((r) => {
              const delta = Math.round((n(r.total_hours) - (priorHours.get(r.store_id) ?? 0)) * 100) / 100;
              const covered = n(r.days_covered);
              return (
                <tr key={r.store_id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.store_code ? `#${r.store_code} · ` : ""}{r.store_name}</div>
                    {r.region && <div className="text-xs text-gray-500">{r.region}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {r.submitted_by ? (
                      <>
                        <div>{r.submitted_by}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(r.submitted_at!).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                      </>
                    ) : (
                      <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Not submitted</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular">{h(r.cashier_hours)}</td>
                  <td className="px-3 py-3 text-right tabular">{h(r.sales_hours)}</td>
                  <td className="px-3 py-3 text-right tabular">{h(r.keyholder_hours)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular">{h(r.total_hours)}</td>
                  <td className={`px-3 py-3 text-right tabular ${delta > 0 ? "text-amber-700" : delta < 0 ? "text-emerald-700" : "text-gray-400"}`}>
                    {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${formatHours(delta)}`}
                  </td>
                  <td className="px-3 py-3 text-right tabular">{r.people_scheduled}</td>
                  <td className="px-4 py-3">
                    {n(r.shift_count) === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : covered < 7 ? (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{7 - covered} day{7 - covered === 1 ? "" : "s"} empty</span>
                    ) : (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">All 7 days</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-brand-600 hover:underline" href={`/schedule?store=${r.store_id}&week=${week}`}>View</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isThisWeek && (
        <section>
          <h2 className="mb-2 font-semibold">Working today</h2>
          {todayByStore.size === 0 ? (
            <p className="text-sm text-gray-500">No one is scheduled today.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...todayByStore.entries()].map(([store, list]) => (
                <div key={store} className="card p-4">
                  <div className="mb-2 font-medium">{store}</div>
                  <ul className="space-y-1 text-sm">
                    {list.map((s, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{s.employee_name} <span className="text-gray-500">· {s.role}</span></span>
                        <span className="text-gray-600 tabular">{formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </Shell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold tabular ${tone === "bad" ? "text-red-700" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}
