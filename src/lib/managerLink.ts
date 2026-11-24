import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";

const KEY = "manager_link_token";

/** The secret in the managers' link. Readable only with the service role. */
export async function getManagerToken(): Promise<string | null> {
  const { data } = await createServiceClient().from("app_settings").select("value").eq("key", KEY).single();
  return data?.value ?? null;
}

export async function isValidManagerToken(candidate: string): Promise<boolean> {
  const real = await getManagerToken();
  if (!real || typeof candidate !== "string") return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Replace the secret. The old link stops working immediately. */
export async function rotateManagerToken(): Promise<string> {
  const { randomBytes } = await import("node:crypto");
  const value = randomBytes(24).toString("hex");
  const { error } = await createServiceClient()
    .from("app_settings")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return value;
}
