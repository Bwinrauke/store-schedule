import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/session";
import { addDays, resolveWeek } from "@/lib/week";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote, and neutralise leading formula characters for spreadsheet safety.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV of a week's shifts. RLS limits it to the stores the caller can see. */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (profile.role !== "executive") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const week = resolveWeek(request.nextUrl.searchParams.get("week"));
  const store = request.nextUrl.searchParams.get("store");

  const supabase = await createClient();
  let query = supabase
    .from("shift_details")
    .select("store_code, store_name, employee_name, role, shift_date, start_time, end_time, hours")
    .gte("shift_date", week)
    .lte("shift_date", addDays(week, 6))
    .order("store_name")
    .order("shift_date")
    .order("start_time");
  if (store) query = query.eq("store_id", store);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const header = ["Store #", "Store", "Employee", "Role", "Date", "Start", "End", "Hours"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of data ?? []) {
    lines.push(
      [r.store_code, r.store_name, r.employee_name, r.role, r.shift_date, r.start_time.slice(0, 5), r.end_time.slice(0, 5), r.hours]
        .map(csvCell)
        .join(","),
    );
  }
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="schedule-${week}.csv"`,
    },
  });
}
