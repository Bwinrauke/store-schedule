import { headers } from "next/headers";
import { Shell } from "@/components/Shell";
import { createClient } from "@/lib/supabase/server";
import { getManagerToken } from "@/lib/managerLink";
import { requireExecutive } from "@/lib/session";
import type { Profile, Store } from "@/lib/types";
import { ManagerLinkPanel } from "./ManagerLinkPanel";
import { StoresPanel } from "./StoresPanel";
import { UsersPanel } from "./UsersPanel";

export default async function AdminPage() {
  const me = await requireExecutive();
  const supabase = await createClient();
  const [{ data: stores }, { data: profiles }, token, h] = await Promise.all([
    supabase.from("stores").select("id, name, code, region, active").order("code", { nullsFirst: false }).order("name"),
    supabase.from("profiles").select("id, email, full_name, role").order("email"),
    getManagerToken(),
    headers(),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const link = token && host ? `${proto}://${host}/m/${token}` : null;

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Admin</h1>
      <div className="grid gap-8">
        <ManagerLinkPanel link={link} />
        <StoresPanel stores={(stores ?? []) as Store[]} />
        <UsersPanel meId={me.id} profiles={(profiles ?? []) as Profile[]} />
      </div>
    </Shell>
  );
}
