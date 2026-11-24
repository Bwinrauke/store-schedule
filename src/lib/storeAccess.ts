import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Store managers have no accounts. Each store has a 4-digit PIN; entering it
 * sets a signed cookie for that store, so the phone remembers it. Changing
 * the PIN in Admin invalidates every remembered phone, because the cookie
 * carries the PIN's version (when it was last set).
 */

export const PIN_REMEMBER_DAYS = 180;
/** Wrong tries allowed per phone (IP) per store in the window. */
export const MAX_FAILS_PER_IP = 5;
export const IP_WINDOW_MINUTES = 15;
/** Wrong tries allowed per store from anywhere in the window. */
export const MAX_FAILS_PER_STORE = 30;
export const STORE_WINDOW_MINUTES = 60;

const cookieName = (storeId: string) => `store_${storeId}`;

let secretCache: string | null = null;
async function cookieSecret(): Promise<string> {
  if (secretCache) return secretCache;
  const { data, error } = await createServiceClient()
    .from("app_settings")
    .select("value")
    .eq("key", "cookie_secret")
    .single();
  if (error || !data) throw new Error("cookie_secret is missing from app_settings");
  secretCache = data.value as string;
  return secretCache;
}

/** Pure signing helpers, exported for tests. */
export function signGrant(secret: string, storeId: string, version: string, expiresAt: number): string {
  const body = `${version}.${expiresAt}`;
  const mac = createHmac("sha256", secret).update(`${storeId}.${body}`).digest("base64url");
  return `${body}.${mac}`;
}

export function grantIsValid(secret: string, storeId: string, version: string, value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [v, exp, mac] = parts;
  if (v !== version || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  const expected = signGrant(secret, storeId, v, Number(exp)).split(".")[2];
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The PIN's version, or null when the store has no PIN set. */
async function pinVersion(storeId: string): Promise<{ pin: string; version: string } | null> {
  const { data } = await createServiceClient()
    .from("store_pins")
    .select("pin, updated_at")
    .eq("store_id", storeId)
    .maybeSingle();
  return data ? { pin: data.pin as string, version: String(Date.parse(data.updated_at as string)) } : null;
}

/** Has this phone entered the store's current PIN? */
export async function hasStoreAccess(storeId: string): Promise<boolean> {
  const current = await pinVersion(storeId);
  if (!current) return false;
  const jar = await cookies();
  return grantIsValid(await cookieSecret(), storeId, current.version, jar.get(cookieName(storeId))?.value);
}

export async function storeHasPin(storeId: string): Promise<boolean> {
  return (await pinVersion(storeId)) !== null;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export type PinResult =
  | { ok: true }
  | { ok: false; reason: "no_pin" | "locked" | "wrong"; triesLeft?: number };

/** Check a PIN with attempt limits; on success, remember this phone. */
export async function enterStorePin(storeId: string, pin: string): Promise<PinResult> {
  const current = await pinVersion(storeId);
  if (!current) return { ok: false, reason: "no_pin" };

  const db = createServiceClient();
  const ip = await clientIp();
  const since = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const [{ count: ipFails }, { count: storeFails }] = await Promise.all([
    db.from("pin_attempts").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("ip", ip).eq("ok", false).gte("at", since(IP_WINDOW_MINUTES)),
    db.from("pin_attempts").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("ok", false).gte("at", since(STORE_WINDOW_MINUTES)),
  ]);
  if ((ipFails ?? 0) >= MAX_FAILS_PER_IP || (storeFails ?? 0) >= MAX_FAILS_PER_STORE) {
    return { ok: false, reason: "locked" };
  }

  const a = Buffer.from(String(pin));
  const b = Buffer.from(current.pin);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  await db.from("pin_attempts").insert({ store_id: storeId, ip, ok });

  if (!ok) {
    return { ok: false, reason: "wrong", triesLeft: Math.max(0, MAX_FAILS_PER_IP - (ipFails ?? 0) - 1) };
  }

  const expiresAt = Date.now() + PIN_REMEMBER_DAYS * 86_400_000;
  const jar = await cookies();
  jar.set(cookieName(storeId), signGrant(await cookieSecret(), storeId, current.version, expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return { ok: true };
}

export async function forgetStore(storeId: string): Promise<void> {
  (await cookies()).delete(cookieName(storeId));
}

/** For Admin: every store's PIN. Caller must have checked requireExecutive(). */
export async function listPins(): Promise<Map<string, string>> {
  const { data } = await createServiceClient().from("store_pins").select("store_id, pin");
  return new Map((data ?? []).map((r) => [r.store_id as string, r.pin as string]));
}

/** For Admin: set or change a PIN. Caller must have checked requireExecutive(). */
export async function setPin(storeId: string, pin: string): Promise<string | null> {
  if (!/^\d{4}$/.test(pin)) return "The PIN must be exactly 4 digits.";
  const { error } = await createServiceClient()
    .from("store_pins")
    .upsert({ store_id: storeId, pin, updated_at: new Date().toISOString() });
  return error ? error.message : null;
}
