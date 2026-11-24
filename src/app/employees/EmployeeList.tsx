"use client";

import { useRef, useState, useTransition } from "react";
import type { Employee } from "@/lib/types";
import { addEmployee, updateEmployee } from "./actions";

export function EmployeeList({ storeId, employees }: { storeId: string; employees: Employee[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card divide-y divide-gray-100">
        {employees.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No employees yet. Add your first on the right.</p>}
        {employees.map((e) => <Row key={e.id} employee={e} />)}
      </div>

      <form
        ref={formRef}
        className="card h-fit space-y-3 p-4"
        action={(fd) =>
          start(async () => {
            const res = await addEmployee(fd);
            setError(res.error);
            if (!res.error) formRef.current?.reset();
          })
        }
      >
        <h2 className="font-medium">Add employee</h2>
        <input type="hidden" name="store_id" value={storeId} />
        <div>
          <label className="label" htmlFor="full_name">Name</label>
          <input id="full_name" name="full_name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="position">Position</label>
          <input id="position" name="position" className="input" placeholder="Sales Associate" list="positions" />
          <datalist id="positions">
            <option value="Sales Associate" /><option value="Key Holder" /><option value="Assistant Manager" />
            <option value="Store Manager" /><option value="Stock" /><option value="Cashier" />
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input id="phone" name="phone" type="tel" className="input" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Adding…" : "Add employee"}</button>
      </form>
    </div>
  );
}

function Row({ employee: e }: { employee: Employee }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(e.full_name);
  const [position, setPosition] = useState(e.position);
  const [phone, setPhone] = useState(e.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (changes: Parameters<typeof updateEmployee>[1]) =>
    start(async () => {
      const res = await updateEmployee(e.id, changes);
      setError(res.error);
      if (!res.error) setEditing(false);
    });

  if (editing) {
    return (
      <div className="grid gap-2 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input className="input" value={name} onChange={(ev) => setName(ev.target.value)} aria-label="Name" />
        <input className="input" value={position} onChange={(ev) => setPosition(ev.target.value)} aria-label="Position" list="positions" />
        <input className="input" value={phone} onChange={(ev) => setPhone(ev.target.value)} aria-label="Phone" />
        <div className="flex gap-2">
          <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={pending}
            onClick={() => run({ full_name: name.trim(), position: position.trim(), phone: phone.trim() || null })}>
            Save
          </button>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 ${e.active ? "" : "opacity-60"}`}>
      <div className="min-w-40 flex-1">
        <div className="font-medium">{e.full_name}{!e.active && <span className="ml-2 text-xs text-gray-500">inactive</span>}</div>
        <div className="text-sm text-gray-500">{e.position}{e.phone && ` · ${e.phone}`}</div>
      </div>
      <button className="btn" onClick={() => setEditing(true)}>Edit</button>
      <button className="btn" disabled={pending}
        onClick={() => {
          if (e.active && !confirm(`Mark ${e.full_name} inactive? They'll drop off future schedules but their past shifts are kept.`)) return;
          run({ active: !e.active });
        }}>
        {e.active ? "Deactivate" : "Reactivate"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
