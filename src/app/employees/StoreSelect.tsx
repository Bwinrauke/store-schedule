"use client";

import { useRouter } from "next/navigation";
import type { Store } from "@/lib/types";

export function StoreSelect({ stores, storeId }: { stores: Store[]; storeId: string }) {
  const router = useRouter();
  if (stores.length < 2) return <span className="text-sm text-gray-500">{stores[0]?.name}</span>;
  return (
    <select aria-label="Store" className="input w-auto min-w-48" value={storeId}
      onChange={(e) => router.push(`?store=${e.target.value}`)}>
      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
