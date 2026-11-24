import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store } from "@/lib/types";

/** The signed-in user's profile. Redirects to /login if there is none. */
export async function getProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();
  if (!data) redirect("/auth/error?reason=" + encodeURIComponent("No profile for this account."));
  return data as Profile;
}

export async function requireExecutive(): Promise<Profile> {
  const profile = await getProfile();
  if (profile.role !== "executive") redirect("/");
  return profile;
}

/** Stores the caller may see. RLS does the filtering. */
export async function getMyStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, name, code, region, active")
    .eq("active", true)
    .order("name");
  return (data ?? []) as Store[];
}
