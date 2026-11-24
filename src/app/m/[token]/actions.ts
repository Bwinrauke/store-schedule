"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { isValidManagerToken } from "@/lib/managerLink";
import { isIsoDate, weekStart } from "@/lib/week";
import { buildPayload, type Entry } from "@/lib/week-form";

export async function saveWeek(input: {
  token: string;
  storeId: string;
  week: string;
  submittedBy: string;
  entries: Entry[];
}): Promise<{ error: string | null; message?: string }> {
  // The link's secret is the only thing standing in for a login, so check it
  // on every write, not just when the page loads.
  if (!(await isValidManagerToken(input.token))) {
    return { error: "This link is no longer valid. Ask upper management for the current link." };
  }
  if (!isIsoDate(input.week) || weekStart(input.week) !== input.week) return { error: "Pick a week." };
  if (!input.submittedBy?.trim()) return { error: "Enter your name before saving." };
  if (!Array.isArray(input.entries) || input.entries.length > 500) return { error: "Too many shifts." };

  const built = buildPayload(input.entries, input.week);
  if ("error" in built) return { error: built.error };

  const { data, error } = await createServiceClient().rpc("save_week", {
    p_store: input.storeId,
    p_week: input.week,
    p_submitted_by: input.submittedBy.trim().slice(0, 80),
    p_shifts: built.shifts,
  });
  if (error) return { error: error.code === "P0001" ? error.message : friendlyError(error) };

  revalidatePath(`/m/${input.token}`);
  const people = new Set(built.shifts.map((s) => s.name.toLowerCase())).size;
  return {
    error: null,
    message: `Saved ${data} shift${data === 1 ? "" : "s"} for ${people} ${people === 1 ? "person" : "people"}.`,
  };
}
