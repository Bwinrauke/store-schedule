"use client";

import { useState, useTransition } from "react";
import { copyPreviousWeek } from "./actions";

export function CopyWeekButton({ storeId, week }: { storeId: string; week: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      {note && <span className="text-sm text-gray-600">{note}</span>}
      <button
        className="btn"
        disabled={pending}
        onClick={() => {
          if (!confirm("Copy last week's shifts into this week? Existing shifts are kept.")) return;
          start(async () => {
            const res = await copyPreviousWeek(storeId, week);
            setNote(res.error ?? res.message ?? null);
          });
        }}
      >
        {pending ? "Copying…" : "Copy last week"}
      </button>
    </span>
  );
}
