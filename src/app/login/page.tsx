import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold">Store Schedule</h1>
        <p className="mb-6 text-center text-sm text-gray-500">Sign in to see your store's week.</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
