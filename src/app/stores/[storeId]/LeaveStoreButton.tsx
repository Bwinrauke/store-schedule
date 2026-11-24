"use client";

import { useRouter } from "next/navigation";
import { leaveStore } from "./actions";

/** Forget this store on this phone (e.g. a shared or borrowed device). */
export function LeaveStoreButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  return (
    <button
      className="text-gray-500 hover:text-gray-900"
      onClick={async () => {
        if (!confirm("Lock this store on this phone? You'll need the PIN again.")) return;
        await leaveStore(storeId);
        router.push("/stores");
      }}
    >
      Lock
    </button>
  );
}
