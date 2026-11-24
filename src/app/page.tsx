import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";

export default async function Home() {
  const profile = await getProfile();
  redirect(profile.role === "executive" ? "/overview" : "/schedule");
}
