"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Store } from "@/lib/types";

export function StorePicker({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const go = (id: string) => router.push(`/stores/${id}`);

  if (stores.length === 0) {
    return <div className="card p-6 text-center text-sm text-gray-500">No stores have been set up yet.</div>;
  }

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h1 className="text-lg font-semibold">Which store?</h1>
        <p className="text-sm text-gray-500">Type your store number, or pick it from the list.</p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = number.trim().replace(/^#/, "").toLowerCase();
          const match = stores.find((s) => (s.code ?? "").toLowerCase() === n);
          if (match) go(match.id);
          else setError(`No store number ${number.trim()}. Pick from the list below.`);
        }}
      >
        <input
          className="input text-lg"
          inputMode="numeric"
          placeholder="Store #"
          aria-label="Store number"
          value={number}
          onChange={(e) => { setNumber(e.target.value); setError(null); }}
          autoFocus
        />
        <button className="btn btn-primary px-5">Go</button>
      </form>
      {error && <p className="-mt-3 text-sm text-red-600">{error}</p>}
      <div>
        <label className="label" htmlFor="store-list">Or choose</label>
        <select id="store-list" className="input" defaultValue="" onChange={(e) => e.target.value && go(e.target.value)}>
          <option value="" disabled>Select your store…</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code ? `#${s.code} — ` : ""}{s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
