import Link from "next/link";

export default async function AuthError({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-6 text-center">
        <p className="font-medium">Sign-in didn't work</p>
        <p className="mt-2 text-sm text-gray-500">{reason ?? "The link may have expired. Try again."}</p>
        <Link href="/login" className="btn mt-4">Back to sign in</Link>
      </div>
    </div>
  );
}
