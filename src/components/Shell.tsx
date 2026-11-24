import Link from "next/link";
import { getProfile } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";
import { NavLinks } from "./NavLinks";

export async function Shell({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const links =
    profile.role === "executive"
      ? [
          { href: "/overview", label: "Overview" },
          { href: "/schedule", label: "Schedules" },
          { href: "/employees", label: "Employees" },
          { href: "/admin", label: "Admin" },
        ]
      : [
          { href: "/schedule", label: "Schedule" },
          { href: "/employees", label: "Employees" },
        ];

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-base font-semibold text-gray-900">
            Store Schedule
          </Link>
          <NavLinks links={links} />
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden sm:inline">
              {profile.full_name || profile.email}
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                {profile.role === "executive" ? "Upper management" : "Store manager"}
              </span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
