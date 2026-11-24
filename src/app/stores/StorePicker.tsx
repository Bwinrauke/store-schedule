"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Store } from "@/lib/types";

export function StorePicker({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (stores.length === 0) {
    return <div className="card p-6 text-center text-sm text-gray-500">No stores have been set up yet.</div>;
  }

  return (
    <div className="card space-y-4 p-6">
      <label htmlFor="store-list" className="block text-lg font-semibold">
        Which store?
      </label>
      <select
        id="store-list"
        className="input text-lg"
        defaultValue=""
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          if (id) start(() => router.push(`/stores/${id}`));
        }}
      >
        <option value="" disabled>
          Select your store…
        </option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code ? `#${s.code} — ` : ""}
            {s.name}
          </option>
        ))}
      </select>
      {pending && <p className="text-sm text-gray-500">Opening…</p>}
    </div>
  );
}
