import Link from "next/link";

export function ManagerHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/stores" className="font-semibold">Weekly Schedule</Link>
        <div className="ml-auto text-sm">{children}</div>
      </div>
    </header>
  );
}
