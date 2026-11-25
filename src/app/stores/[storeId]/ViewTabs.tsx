import Link from "next/link";

/** Switch between entering the schedule and viewing what's saved. */
export function ViewTabs({ week, active }: { week: string; active: "edit" | "saved" }) {
  const tab = (key: "edit" | "saved", label: string, href: string) => (
    <Link
      href={href}
      role="tab"
      aria-selected={active === key}
      className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium ${
        active === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="no-print mb-4 flex gap-1 rounded-lg bg-gray-200/70 p-1 sm:max-w-sm" role="tablist" aria-label="View">
      {tab("edit", "Enter schedule", `?week=${week}`)}
      {tab("saved", "Saved week", `?week=${week}&view=saved`)}
    </div>
  );
}
