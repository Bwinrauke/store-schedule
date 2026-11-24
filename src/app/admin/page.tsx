import { Shell } from "@/components/Shell";
import { createClient } from "@/lib/supabase/server";
import { requireExecutive } from "@/lib/session";
import type { Profile, Store } from "@/lib/types";
import { StoresPanel } from "./StoresPanel";
import { UsersPanel } from "./UsersPanel";

export default async function AdminPage() {
  const me = await requireExecutive();
  const supabase = await createClient();
  const [{ data: stores }, { data: profiles }, { data: assignments }] = await Promise.all([
    supabase.from("stores").select("id, name, code, region, active").order("name"),
    supabase.from("profiles").select("id, email, full_name, role").order("email"),
    supabase.from("store_managers").select("store_id, user_id"),
  ]);

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Admin</h1>
      <div className="grid gap-8">
        <StoresPanel stores={(stores ?? []) as Store[]} />
        <UsersPanel
          meId={me.id}
          stores={((stores ?? []) as Store[]).filter((s) => s.active)}
          profiles={(profiles ?? []) as Profile[]}
          assignments={assignments ?? []}
        />
      </div>
    </Shell>
  );
}
