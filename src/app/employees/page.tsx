import { Shell } from "@/components/Shell";
import { createClient } from "@/lib/supabase/server";
import { getMyStores } from "@/lib/session";
import type { Employee } from "@/lib/types";
import { EmployeeList } from "./EmployeeList";
import { StoreSelect } from "./StoreSelect";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const params = await searchParams;
  const stores = await getMyStores();
  if (stores.length === 0) {
    return (
      <Shell>
        <div className="card p-8 text-center text-sm text-gray-500">No stores assigned yet.</div>
      </Shell>
    );
  }
  const store = stores.find((s) => s.id === params.store) ?? stores[0];
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id, store_id, full_name, position, phone, active")
    .eq("store_id", store.id)
    .order("active", { ascending: false })
    .order("full_name");

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Employees</h1>
        <StoreSelect stores={stores} storeId={store.id} />
      </div>
      <EmployeeList storeId={store.id} employees={(data ?? []) as Employee[]} />
    </Shell>
  );
}
