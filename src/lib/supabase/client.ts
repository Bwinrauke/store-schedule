import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
  );
}
