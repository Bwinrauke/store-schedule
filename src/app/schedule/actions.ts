"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { addDays, isIsoDate } from "@/lib/week";

export type ActionResult = { error: string | null; message?: string };

const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

export type ShiftInput = {
  id?: string;
  store_id: string;
  employee_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  position?: string;
  note?: string;
};

export async function saveShift(input: ShiftInput): Promise<ActionResult> {
  if (!isIsoDate(input.shift_date) || !TIME.test(input.start_time) || !TIME.test(input.end_time)) {
    return { error: "Enter a valid date and times." };
  }
  const row = {
    store_id: input.store_id,
    employee_id: input.employee_id,
    shift_date: input.shift_date,
    start_time: input.start_time,
    end_time: input.end_time,
    break_minutes: Math.max(0, Math.round(Number(input.break_minutes) || 0)),
    position: input.position?.trim() || null,
    note: input.note?.trim() || null,
  };

  const supabase = await createClient();
  const { error } = input.id
    ? await supabase.from("shifts").update(row).eq("id", input.id)
    : await supabase.from("shifts").insert(row);

  revalidatePath("/schedule");
  return { error: friendlyError(error) };
}

export async function deleteShift(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  revalidatePath("/schedule");
  return { error: friendlyError(error) };
}

export async function copyPreviousWeek(storeId: string, week: string): Promise<ActionResult> {
  if (!isIsoDate(week)) return { error: "Bad week." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_week", {
    target_store: storeId,
    from_week: addDays(week, -7),
    to_week: week,
  });
  revalidatePath("/schedule");
  if (error) return { error: friendlyError(error) };
  const n = Number(data ?? 0);
  return {
    error: null,
    message: n === 0 ? "Nothing new to copy from last week." : `Copied ${n} shift${n === 1 ? "" : "s"} from last week.`,
  };
}
