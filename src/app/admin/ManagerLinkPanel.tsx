"use client";

import { useState, useTransition } from "react";
import { rotateLink } from "./actions";

export function ManagerLinkPanel({ link, onPreviewAddress }: { link: string | null; onPreviewAddress: boolean }) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section>
      <h2 className="mb-2 font-semibold">Store manager link</h2>
      <div className="card space-y-3 p-4">
        <p className="text-sm text-gray-600">
          Managers don&apos;t need an account. Send them this link; they pick their store and enter the week.
          Anyone with the link can edit schedules, so share it only with managers.
        </p>
        {onPreviewAddress && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You&apos;re on a Vercel preview address, which asks visitors to log in to Vercel. The link below uses
            your main address instead, so managers won&apos;t see that.
          </p>
        )}
        {link ? (
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1 font-mono text-xs" readOnly value={link} aria-label="Manager link" onFocus={(e) => e.target.select()} />
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setNote("Couldn't copy automatically. Select the link and copy it.");
                }
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <a className="btn" href={link} target="_blank" rel="noreferrer">Open</a>
          </div>
        ) : (
          <p className="text-sm text-red-600">The link isn&apos;t available. Check SUPABASE_SERVICE_ROLE_KEY is set in Vercel.</p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <button
            className="btn btn-danger"
            disabled={pending}
            onClick={() => {
              if (!confirm("Make a new link? The current link stops working immediately and you'll need to send the new one to every manager.")) return;
              start(async () => setNote((await rotateLink()).message ?? null));
            }}
          >
            {pending ? "Working…" : "Make a new link"}
          </button>
          <span className="text-sm text-gray-500">{note ?? "Use this if the link was shared with someone who shouldn't have it."}</span>
        </div>
      </div>
    </section>
  );
}
