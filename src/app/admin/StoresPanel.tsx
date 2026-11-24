"use client";

import { useRef, useState, useTransition } from "react";
import type { Store } from "@/lib/types";
import { createStore, setStorePin, updateStore } from "./actions";

export function StoresPanel({ stores, pins }: { stores: Store[]; pins: Record<string, string> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section>
      <h2 className="mb-2 font-semibold">Stores</h2>
      <div className="card divide-y divide-gray-100">
        {stores.length === 0 && <p className="p-4 text-sm text-gray-500">No stores yet.</p>}
        {stores.map((s) => <StoreRow key={s.id} store={s} pin={pins[s.id] ?? null} />)}
        <form
          ref={formRef}
          className="grid gap-2 p-3 sm:grid-cols-[1fr_2fr_1fr_1fr_auto]"
          action={(fd) => start(async () => {
            const res = await createStore(fd);
            setError(res.error);
            if (!res.error) formRef.current?.reset();
          })}
        >
          <input name="code" placeholder="Store #" className="input" aria-label="Store number" />
          <input name="name" required placeholder="Store name" className="input" aria-label="Store name" />
          <input name="region" placeholder="Region (optional)" className="input" aria-label="Region" />
          <input name="pin" placeholder="4-digit PIN" className="input" aria-label="PIN" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" />
          <button className="btn btn-primary" disabled={pending}>Add store</button>
          {error && <p className="text-sm text-red-600 sm:col-span-5">{error}</p>}
        </form>
      </div>
    </section>
  );
}

function StoreRow({ store: s, pin }: { store: Store; pin: string | null }) {
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
      <PinControl storeId={s.id} pin={pin} />
      <button className="btn" onClick={() => setEditing(true)}>Edit</button>
      <button className="btn" disabled={pending} onClick={() => {
        if (s.active && !confirm(`Close ${s.name}? It will be hidden from schedules and the overview. Its history is kept.`)) return;
        run({ active: !s.active });
      }}>{s.active ? "Close store" : "Reopen"}</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}

function PinControl({ storeId, pin }: { storeId: string; pin: string | null }) {
  const [shown, setShown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing || !pin) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await setStorePin(storeId, value);
            setError(res.error);
            if (!res.error) {
              setEditing(false);
              setValue("");
            }
          });
        }}
      >
        <input
          className={`input w-28 text-center tabular ${!pin ? "border-amber-400" : ""}`}
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          autoComplete="off"
          placeholder={pin ? "New PIN" : "Set PIN"}
          aria-label="Store PIN"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <button className="btn btn-primary" disabled={pending || value.length !== 4}>Save</button>
        {pin && <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">PIN</span>
      <button
        type="button"
        className="rounded-md bg-gray-100 px-2 py-1 font-mono tracking-widest tabular"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide PIN" : "Show PIN"}
      >
        {shown ? pin : "••••"}
      </button>
      <button type="button" className="btn" onClick={() => setEditing(true)}>Change</button>
    </div>
  );
}
