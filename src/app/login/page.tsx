import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold">Store Schedule</h1>

        <Link
          href="/stores"
          className="btn btn-primary w-full flex-col gap-0.5 py-4 text-base"
        >
          <span className="text-lg font-semibold">Store managers</span>
          <span className="text-sm font-normal text-white/85">Enter this week&apos;s schedule →</span>
        </Link>

        <div className="my-6 flex items-center gap-3 text-xs font-medium tracking-wide text-gray-400 uppercase">
          <span className="h-px flex-1 bg-gray-200" />
          Upper management
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <LoginForm next={next} />
      </div>
    </div>
  );
}
