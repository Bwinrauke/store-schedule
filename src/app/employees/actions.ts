"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export async function addEmployee(formData: FormData): Promise<{ error: string | null }> {
  const full_name = String(formData.get("full_name") ?? "").trim();
  if (!full_name) return { error: "Enter a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    store_id: String(formData.get("store_id")),
    full_name,
    position: String(formData.get("position") ?? "").trim() || "Sales Associate",
    phone: String(formData.get("phone") ?? "").trim() || null,
  });
  revalidatePath("/employees");
  return { error: friendlyError(error) };
}

export async function updateEmployee(
  id: string,
  changes: { full_name?: string; position?: string; phone?: string | null; active?: boolean },
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("employees").update(changes).eq("id", id);
  revalidatePath("/employees");
  revalidatePath("/schedule");
  return { error: friendlyError(error) };
}
