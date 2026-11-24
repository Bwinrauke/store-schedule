"use client";

import { useRef, useState, useTransition } from "react";
import type { Profile, Role, Store } from "@/lib/types";
import { addUser, setAssignment, setRole } from "./actions";

export function UsersPanel({
  meId,
  stores,
  profiles,
  assignments,
}: {
  meId: string;
  stores: Store[];
  profiles: Profile[];
  assignments: { store_id: string; user_id: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [note, setNote] = useState<{ error: string | null; message?: string } | null>(null);
  const [pending, start] = useTransition();
  const assigned = new Set(assignments.map((a) => `${a.user_id}|${a.store_id}`));

  return (
    <section>
      <h2 className="mb-2 font-semibold">People</h2>
      <form
        ref={formRef}
        className="card mb-3 grid gap-2 p-3 sm:grid-cols-[2fr_1.5fr_1fr_1.5fr_auto]"
        action={(fd) => start(async () => {
          const res = await addUser(fd);
          setNote(res);
          if (!res.error) formRef.current?.reset();
        })}
      >
        <input name="email" type="email" required placeholder="Email" className="input" aria-label="Email" />
        <input name="full_name" placeholder="Full name" className="input" aria-label="Full name" />
        <select name="role" className="input" aria-label="Role" defaultValue="manager">
          <option value="manager">Store manager</option>
          <option value="executive">Upper management</option>
        </select>
        <select name="store_id" className="input" aria-label="Store" defaultValue="">
          <option value="">No store yet</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add person"}</button>
        {note && (
          <p className={`text-sm sm:col-span-5 ${note.error ? "text-red-600" : "text-emerald-700"}`}>{note.error ?? note.message}</p>
        )}
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Person</th>
              <th className="px-4 py-2 font-medium">Access</th>
              <th className="px-4 py-2 font-medium">Stores they manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {profiles.map((p) => (
              <UserRow key={p.id} profile={p} isMe={p.id === meId} stores={stores} assigned={assigned} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserRow({ profile: p, isMe, stores, assigned }: { profile: Profile; isMe: boolean; stores: Store[]; assigned: Set<string> }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string | null }>) => start(async () => setError((await fn()).error));

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{p.full_name || p.email}{isMe && <span className="ml-1 text-xs text-gray-500">(you)</span>}</div>
        {p.full_name && <div className="text-xs text-gray-500">{p.email}</div>}
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </td>
      <td className="px-4 py-3">
        <select className="input w-auto" value={p.role} disabled={pending || isMe} aria-label="Access"
          onChange={(e) => run(() => setRole(p.id, e.target.value as Role))}>
          <option value="manager">Store manager</option>
          <option value="executive">Upper management</option>
        </select>
      </td>
      <td className="px-4 py-3">
        {p.role === "executive" ? (
          <span className="text-gray-500">All stores</span>
        ) : stores.length === 0 ? (
          <span className="text-gray-500">Add a store first</span>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {stores.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5">
                <input type="checkbox" disabled={pending} checked={assigned.has(`${p.id}|${s.id}`)}
                  onChange={(e) => run(() => setAssignment(p.id, s.id, e.target.checked))} />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
