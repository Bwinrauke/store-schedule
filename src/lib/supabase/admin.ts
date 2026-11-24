import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS. Used only to send invitation emails,
 * and only after requireExecutive() has checked the caller.
 * Never import this into client code.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set; it is needed to invite users.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
