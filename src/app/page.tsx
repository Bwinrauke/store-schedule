import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { SignOutButton } from "@/components/SignOutButton";

export default async function Home() {
  const profile = await getProfile();
  if (profile.role === "executive") redirect("/overview");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-6 text-center">
        <p className="font-medium">This account doesn&apos;t have access yet</p>
        <p className="mt-2 text-sm text-gray-500">
          Sign-in is for upper management. Store managers use the store schedule link instead.
        </p>
        <div className="mt-4"><SignOutButton /></div>
      </div>
    </div>
  );
}
