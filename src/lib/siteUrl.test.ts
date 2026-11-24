import { afterEach, describe, expect, it, vi } from "vitest";
import { isDeploymentOnlyHost, siteUrl } from "./siteUrl";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("prefers the production domain over a preview address", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "store-schedule.vercel.app");
    expect(siteUrl("store-schedule-git-main-ben.vercel.app")).toBe("https://store-schedule.vercel.app");
    expect(isDeploymentOnlyHost("store-schedule-abc123-ben.vercel.app")).toBe(true);
    expect(isDeploymentOnlyHost("store-schedule.vercel.app")).toBe(false);
  });
  it("lets an explicit address win", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "store-schedule.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://schedule.example.com/");
    expect(siteUrl("anything.vercel.app")).toBe("https://schedule.example.com");
  });
  it("falls back to the request host locally", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(siteUrl("localhost:3000")).toBe("http://localhost:3000");
  });
});
