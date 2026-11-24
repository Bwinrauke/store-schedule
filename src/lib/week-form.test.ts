import { describe, expect, it } from "vitest";
import { buildPayload, emptyDays, TIME_OPTIONS, type FormRow } from "./week-form";

const row = (over: Partial<FormRow>): FormRow => ({ key: "k", name: "Ann", role: "Cashier", days: emptyDays(), ...over });

describe("buildPayload", () => {
  it("maps day columns to dates and skips days off", () => {
    const days = emptyDays();
    days[0] = { start: "09:00", end: "17:00" };
    days[6] = { start: "12:00", end: "16:00" };
    const res = buildPayload([row({ days })], "2026-11-22");
    expect(res).toEqual({
      rows: [{ name: "Ann", role: "Cashier", days: [
        { date: "2026-11-22", start: "09:00", end: "17:00" },
        { date: "2026-11-28", start: "12:00", end: "16:00" },
      ] }],
    });
  });
  it("drops fully blank rows", () => {
    expect(buildPayload([row({ name: "  ", role: "" })], "2026-11-22")).toEqual({ rows: [] });
  });
  it("explains each mistake", () => {
    const half = emptyDays(); half[1] = { start: "09:00", end: "" };
    const back = emptyDays(); back[1] = { start: "17:00", end: "09:00" };
    const orphan = emptyDays(); orphan[2] = { start: "09:00", end: "10:00" };
    expect(buildPayload([row({ role: "" })], "2026-11-22")).toEqual({ error: "Pick a role for Ann." });
    expect(buildPayload([row({ days: half })], "2026-11-22")).toMatchObject({ error: expect.stringContaining("both a start and an end") });
    expect(buildPayload([row({ days: back })], "2026-11-22")).toMatchObject({ error: expect.stringContaining("ends before") });
    expect(buildPayload([row({ name: "", days: orphan })], "2026-11-22")).toMatchObject({ error: expect.stringContaining("no employee name") });
    expect(buildPayload([row({}), row({ name: "ann " })], "2026-11-22")).toEqual({ error: "ann is listed twice." });
  });
  it("offers half-hour times from 5a to 11:30p", () => {
    expect(TIME_OPTIONS[0]).toBe("05:00");
    expect(TIME_OPTIONS.at(-1)).toBe("23:30");
  });
});
