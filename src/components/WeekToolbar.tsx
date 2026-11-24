"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Store } from "@/lib/types";
import { addDays, formatWeekRange } from "@/lib/week";

/** Store picker and week navigation, kept in the URL so links can be shared. */
export function WeekToolbar({
  week,
  stores,
  storeId,
  children,
}: {
  week: string;
  stores?: Store[];
  storeId?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    return `${pathname}?${next.toString()}`;
  };

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      {stores && stores.length > 1 && (
        <select
          aria-label="Store"
          className="input w-auto min-w-48 font-medium"
          value={storeId}
          onChange={(e) => router.push(hrefWith({ store: e.target.value }))}
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-1">
        <Link className="btn px-3" href={hrefWith({ week: addDays(week, -7) })} aria-label="Previous week">
          ←
        </Link>
        <Link className="btn" href={hrefWith({ week: null })}>
          This week
        </Link>
        <Link className="btn px-3" href={hrefWith({ week: addDays(week, 7) })} aria-label="Next week">
          →
        </Link>
      </div>
      <span className="text-sm font-medium text-gray-700">{formatWeekRange(week)}</span>
      <div className="ml-auto flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
