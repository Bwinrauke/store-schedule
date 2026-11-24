"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/errors";
import { rotateManagerToken } from "@/lib/managerLink";
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
    .insert({ name, code: text(fd, "code").replace(/^#/, "") || null, region: text(fd, "region") || null });
  revalidatePath("/admin");
  return { error: error?.code === "23505" ? "Another store already has that number." : friendlyError(error) };
}

export async function updateStore(
  id: string,
  changes: { name?: string; code?: string | null; region?: string | null; active?: boolean },
): Promise<Result> {
  await requireExecutive();
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update(changes).eq("id", id);
  revalidatePath("/admin");
  return { error: error?.code === "23505" ? "Another store already has that number." : friendlyError(error) };
}

/**
 * Gives someone in upper management a login. They sign in at the site with
 * an emailed link; nobody else can sign up.
 */
export async function addUser(fd: FormData): Promise<Result> {
  await requireExecutive();
  const email = text(fd, "email").toLowerCase();
  const full_name = text(fd, "full_name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };

  const { data, error } = await createServiceClient().auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) {
    return { error: /already/i.test(error.message) ? "That email already has an account." : error.message };
  }

  const supabase = await createClient();
  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: "executive", full_name })
    .eq("id", data.user.id);
  if (roleError) return { error: friendlyError(roleError) };

  revalidatePath("/admin");
  return { error: null, message: `Added ${email}. They can sign in with their email now.` };
}

export async function setRole(userId: string, role: Role): Promise<Result> {
  const me = await requireExecutive();
  if (userId === me.id && role !== "executive") {
    return { error: "You can't remove your own access. Ask someone else in upper management." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin");
  return { error: friendlyError(error) };
}

/** Replace the managers' link. The old one stops working at once. */
export async function rotateLink(): Promise<Result> {
  await requireExecutive();
  await rotateManagerToken();
  revalidatePath("/admin");
  return { error: null, message: "New link made. Send it to your managers; the old one no longer works." };
}
