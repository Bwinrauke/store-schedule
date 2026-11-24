import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: vi.fn() }));

const { grantIsValid, signGrant } = await import("./storeAccess");

const S = "secret";
const store = "store-a";

describe("store access cookie", () => {
  const future = Date.now() + 60_000;
  it("accepts a cookie it signed", () => {
    expect(grantIsValid(S, store, "v1", signGrant(S, store, "v1", future))).toBe(true);
  });
  it("rejects a changed PIN, another store, expiry, tampering and a wrong secret", () => {
    const good = signGrant(S, store, "v1", future);
    expect(grantIsValid(S, store, "v2", good)).toBe(false);
    expect(grantIsValid(S, "store-b", "v1", good)).toBe(false);
    expect(grantIsValid(S, store, "v1", signGrant(S, store, "v1", Date.now() - 1))).toBe(false);
    expect(grantIsValid(S, store, "v1", good.replace(/\.\d+\./, `.${future + 999999}.`))).toBe(false);
    expect(grantIsValid("other", store, "v1", good)).toBe(false);
    expect(grantIsValid(S, store, "v1", undefined)).toBe(false);
    expect(grantIsValid(S, store, "v1", "garbage")).toBe(false);
  });
});
