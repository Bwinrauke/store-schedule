import { headers } from "next/headers";
import { Shell } from "@/components/Shell";
import { createClient } from "@/lib/supabase/server";
import { requireExecutive } from "@/lib/session";
import { siteUrl } from "@/lib/siteUrl";
import { listPins } from "@/lib/storeAccess";
import type { Profile, Store } from "@/lib/types";
import { StoresPanel } from "./StoresPanel";
import { UsersPanel } from "./UsersPanel";

export default async function AdminPage() {
  const me = await requireExecutive();
  const supabase = await createClient();
  const [{ data: stores }, { data: profiles }, pins, h] = await Promise.all([
    supabase.from("stores").select("id, name, code, region, active").order("code", { nullsFirst: false }).order("name"),
    supabase.from("profiles").select("id, email, full_name, role").order("email"),
    listPins(),
    headers(),
  ]);
  const base = siteUrl(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"));
  const storeList = (stores ?? []) as Store[];
  const missing = storeList.filter((s) => s.active && !pins.has(s.id)).length;

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Admin</h1>
      <div className="grid gap-8">
        <section>
          <h2 className="mb-2 font-semibold">How store managers get in</h2>
          <div className="card space-y-2 p-4 text-sm text-gray-700">
            <p>
              Managers go to <b>{base ?? "this site"}</b>, tap <b>Store managers</b>, pick their store, and enter its
              4-digit PIN. Their phone remembers it. Set each store&apos;s PIN below.
            </p>
            <p className="text-gray-500">
              Changing a PIN makes every phone enter the new one. Too many wrong tries locks that phone out for 15
              minutes.
            </p>
            {missing > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                {missing} store{missing === 1 ? " has" : "s have"} no PIN yet, so {missing === 1 ? "its" : "their"} manager
                can&apos;t get in.
              </p>
            )}
          </div>
        </section>
        <StoresPanel stores={storeList} pins={Object.fromEntries(pins)} />
        <UsersPanel meId={me.id} profiles={(profiles ?? []) as Profile[]} />
      </div>
    </Shell>
  );
}
