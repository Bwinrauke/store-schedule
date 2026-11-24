"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { enterStorePin, forgetStore, hasStoreAccess, IP_WINDOW_MINUTES } from "@/lib/storeAccess";
import { isIsoDate, weekStart } from "@/lib/week";
import { buildPayload, type Entry } from "@/lib/week-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitPin(storeId: string, pin: string): Promise<{ error: string | null }> {
  if (!UUID.test(storeId)) return { error: "Store not found." };
  if (!/^\d{4}$/.test(pin)) return { error: "Enter the 4-digit PIN." };
  const res = await enterStorePin(storeId, pin);
  if (res.ok) {
    revalidatePath(`/stores/${storeId}`);
    return { error: null };
  }
  switch (res.reason) {
    case "no_pin":
      return { error: "This store doesn't have a PIN yet. Ask upper management to set one." };
    case "locked":
      return { error: `Too many wrong tries. Wait ${IP_WINDOW_MINUTES} minutes, or ask upper management for the PIN.` };
    default:
      return {
        error: res.triesLeft
          ? `Wrong PIN. ${res.triesLeft} ${res.triesLeft === 1 ? "try" : "tries"} left.`
          : `Wrong PIN. Wait ${IP_WINDOW_MINUTES} minutes before trying again.`,
      };
  }
}

export async function leaveStore(storeId: string): Promise<void> {
  if (UUID.test(storeId)) await forgetStore(storeId);
}

export async function saveWeek(input: {
  storeId: string;
  week: string;
  submittedBy: string;
  entries: Entry[];
}): Promise<{ error: string | null; message?: string }> {
  // The PIN cookie stands in for a login, so check it on every save.
  if (!UUID.test(input.storeId) || !(await hasStoreAccess(input.storeId))) {
    return { error: "Your PIN has expired or was changed. Reload the page and enter the store PIN again." };
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

  revalidatePath(`/stores/${input.storeId}`);
  const people = new Set(built.shifts.map((s) => s.name.toLowerCase())).size;
  return {
    error: null,
    message: `Saved ${data} shift${data === 1 ? "" : "s"} for ${people} ${people === 1 ? "person" : "people"}.`,
  };
}
