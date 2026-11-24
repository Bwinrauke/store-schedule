"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { requireExecutive } from "@/lib/session";
import type { Role } from "@/lib/types";

type Result = { error: string | null; message?: string };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function createStore(fd: FormData): Promise<Result> {
  await requireExecutive();
  const name = text(fd, "name");
  if (!name) return { error: "Enter a store name." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .insert({ name, code: text(fd, "code") || null, region: text(fd, "region") || null });
  revalidatePath("/admin");
  return { error: friendlyError(error) };
}

export async function updateStore(
  id: string,
  changes: { name?: string; code?: string | null; region?: string | null; active?: boolean },
): Promise<Result> {
  await requireExecutive();
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update(changes).eq("id", id);
  revalidatePath("/admin");
  return { error: friendlyError(error) };
}

/**
 * Creates the account and sets its role and store up front. The person then
 * signs in at the site with an emailed link; nobody else can sign up.
 */
export async function addUser(fd: FormData): Promise<Result> {
  await requireExecutive();
  const email = text(fd, "email").toLowerCase();
  const full_name = text(fd, "full_name");
  const role = (text(fd, "role") === "executive" ? "executive" : "manager") as Role;
  const storeId = text(fd, "store_id");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };

  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) {
    return { error: /already/i.test(error.message) ? "That email already has an account." : error.message };
  }

  const supabase = await createClient();
  const id = data.user.id;
  const { error: roleError } = await supabase.from("profiles").update({ role, full_name }).eq("id", id);
  if (roleError) return { error: friendlyError(roleError) };
  if (storeId) {
    const { error: assignError } = await supabase.from("store_managers").insert({ store_id: storeId, user_id: id });
    if (assignError) return { error: friendlyError(assignError) };
  }

  revalidatePath("/admin");
  return { error: null, message: `Added ${email}. They can now sign in with their email.` };
}

export async function setRole(userId: string, role: Role): Promise<Result> {
  const me = await requireExecutive();
  if (userId === me.id && role !== "executive") {
    return { error: "You can't remove your own upper-management access. Ask another executive." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin");
  return { error: friendlyError(error) };
}

export async function setAssignment(userId: string, storeId: string, assigned: boolean): Promise<Result> {
  await requireExecutive();
  const supabase = await createClient();
  const { error } = assigned
    ? await supabase.from("store_managers").upsert({ store_id: storeId, user_id: userId })
    : await supabase.from("store_managers").delete().eq("store_id", storeId).eq("user_id", userId);
  revalidatePath("/admin");
  return { error: friendlyError(error) };
}
