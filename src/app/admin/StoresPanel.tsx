"use client";

import { useRef, useState, useTransition } from "react";
import type { Store } from "@/lib/types";
import { createStore, updateStore } from "./actions";

export function StoresPanel({ stores }: { stores: Store[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section>
      <h2 className="mb-2 font-semibold">Stores</h2>
      <div className="card divide-y divide-gray-100">
        {stores.length === 0 && <p className="p-4 text-sm text-gray-500">No stores yet.</p>}
        {stores.map((s) => <StoreRow key={s.id} store={s} />)}
        <form
          ref={formRef}
          className="grid gap-2 p-3 sm:grid-cols-[1fr_2fr_1fr_auto]"
          action={(fd) => start(async () => {
            const res = await createStore(fd);
            setError(res.error);
            if (!res.error) formRef.current?.reset();
          })}
        >
          <input name="code" placeholder="Store #" className="input" aria-label="Store number" />
          <input name="name" required placeholder="Store name" className="input" aria-label="Store name" />
          <input name="region" placeholder="Region (optional)" className="input" aria-label="Region" />
          <button className="btn btn-primary" disabled={pending}>Add store</button>
          {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
        </form>
      </div>
    </section>
  );
}

function StoreRow({ store: s }: { store: Store }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const [code, setCode] = useState(s.code ?? "");
  const [region, setRegion] = useState(s.region ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (c: Parameters<typeof updateStore>[1]) =>
    start(async () => {
      const res = await updateStore(s.id, c);
      setError(res.error);
      if (!res.error) setEditing(false);
    });

  if (editing) {
    return (
      <div className="grid gap-2 p-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Store number" placeholder="Store #" />
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region" />
        <div className="flex gap-2">
          <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={pending}
            onClick={() => run({ name: name.trim(), code: code.trim() || null, region: region.trim() || null })}>Save</button>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 ${s.active ? "" : "opacity-60"}`}>
      <div className="flex-1">
        <div className="font-medium">{s.code && <span className="text-gray-500">#{s.code} </span>}{s.name}{!s.active && <span className="ml-2 text-xs text-gray-500">closed</span>}</div>
        <div className="text-sm text-gray-500">{s.region || "—"}</div>
      </div>
      <button className="btn" onClick={() => setEditing(true)}>Edit</button>
      <button className="btn" disabled={pending} onClick={() => {
        if (s.active && !confirm(`Close ${s.name}? It will be hidden from schedules and the overview. Its history is kept.`)) return;
        run({ active: !s.active });
      }}>{s.active ? "Close store" : "Reopen"}</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
