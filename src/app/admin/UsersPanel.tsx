"use client";

import { useRef, useState, useTransition } from "react";
import type { Profile, Role } from "@/lib/types";
import { addUser, setRole } from "./actions";

export function UsersPanel({ meId, profiles }: { meId: string; profiles: Profile[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [note, setNote] = useState<{ error: string | null; message?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <section>
      <h2 className="mb-2 font-semibold">Upper management logins</h2>
      <form
        ref={formRef}
        className="card mb-3 grid gap-2 p-3 sm:grid-cols-[2fr_1.5fr_auto]"
        action={(fd) => start(async () => {
          const res = await addUser(fd);
          setNote(res);
          if (!res.error) formRef.current?.reset();
        })}
      >
        <input name="email" type="email" required placeholder="Email" className="input" aria-label="Email" />
        <input name="full_name" placeholder="Full name" className="input" aria-label="Full name" />
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add person"}</button>
        {note && <p className={`text-sm sm:col-span-3 ${note.error ? "text-red-600" : "text-emerald-700"}`}>{note.error ?? note.message}</p>}
      </form>

      <div className="card divide-y divide-gray-100">
        {profiles.map((p) => <UserRow key={p.id} profile={p} isMe={p.id === meId} />)}
      </div>
    </section>
  );
}

function UserRow({ profile: p, isMe }: { profile: Profile; isMe: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <div className="flex-1">
        <div className="font-medium">{p.full_name || p.email}{isMe && <span className="ml-1 text-xs text-gray-500">(you)</span>}</div>
        {p.full_name && <div className="text-xs text-gray-500">{p.email}</div>}
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>
      <select
        className="input w-auto"
        value={p.role}
        disabled={pending || isMe}
        aria-label="Access"
        onChange={(e) => start(async () => setError((await setRole(p.id, e.target.value as Role)).error))}
      >
        <option value="executive">Has access</option>
        <option value="manager">No access</option>
      </select>
    </div>
  );
}
