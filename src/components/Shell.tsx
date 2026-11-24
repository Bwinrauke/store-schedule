import Link from "next/link";
import { getProfile } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";
import { NavLinks } from "./NavLinks";

export async function Shell({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const links = [
    { href: "/overview", label: "Overview" },
    { href: "/schedule", label: "Store schedules" },
    { href: "/admin", label: "Admin" },
  ];

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:py-3">
          <Link href="/" className="text-base font-semibold text-gray-900">
            Store Schedule
          </Link>
          <div className="order-last -mx-1 w-full sm:order-none sm:mx-0 sm:w-auto">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden sm:inline">
              {profile.full_name || profile.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
