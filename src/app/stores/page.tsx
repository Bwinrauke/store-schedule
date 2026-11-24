import { createServiceClient } from "@/lib/supabase/admin";
import type { Store } from "@/lib/types";
import { ManagerHeader } from "./ManagerHeader";
import { StorePicker } from "./StorePicker";

export const metadata = { title: "Store managers · Weekly Schedule", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const { data } = await createServiceClient()
    .from("stores")
    .select("id, name, code, region, active")
    .eq("active", true)
    .order("code", { nullsFirst: false })
    .order("name");

  return (
    <div className="min-h-dvh">
      <ManagerHeader />
      <main className="mx-auto max-w-md px-4 py-8">
        <StorePicker stores={(data ?? []) as Store[]} />
      </main>
    </div>
  );
}
