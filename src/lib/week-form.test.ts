import { describe, expect, it } from "vitest";
import { buildPayload, entryHours, missingFields, TIME_OPTIONS, type Entry } from "./week-form";

const e = (over: Partial<Entry>): Entry => ({ key: "k", day: 1, name: "Ann", code: "a1", role: "Cashier", start: "09:00", end: "17:00", ...over });
const W = "2026-11-22"; // Sunday

describe("buildPayload", () => {
  it("turns day entries into dated shifts, in day order", () => {
    expect(buildPayload([e({ day: 6, start: "12:00", end: "16:00" }), e({ day: 0 })], W)).toEqual({
      shifts: [
        { name: "Ann", code: "A1", role: "Cashier", date: "2026-11-22", start: "09:00", end: "17:00" },
        { name: "Ann", code: "A1", role: "Cashier", date: "2026-11-28", start: "12:00", end: "16:00" },
      ],
    });
  });
  it("skips blank rows and tidies names", () => {
    expect(buildPayload([e({ name: "", code: "", role: "", start: "", end: "" }), e({ name: "  Ann   Lee " })], W)).toEqual({
      shifts: [{ name: "Ann Lee", code: "A1", role: "Cashier", date: "2026-11-23", start: "09:00", end: "17:00" }],
    });
  });
  it("allows a split shift but not an overlap", () => {
    expect(buildPayload([e({ end: "12:00" }), e({ name: "ann", start: "13:00", end: "17:00" })], W)).toHaveProperty("shifts");
    expect(buildPayload([e({ end: "13:00" }), e({ name: "ann", start: "12:00" })], W)).toMatchObject({
      error: "Mon: ann is listed twice at overlapping times.",
      day: 1,
    });
  });
  it("names the day in every error", () => {
    expect(buildPayload([e({ role: "" })], W)).toMatchObject({ error: "Mon: pick a role for Ann." });
    expect(buildPayload([e({ name: "" })], W)).toMatchObject({ error: "Mon: enter the employee's name." });
    expect(buildPayload([e({ end: "" })], W)).toMatchObject({ error: "Mon: enter a time in and a time out for Ann." });
    expect(buildPayload([e({ start: "17:00", end: "09:00" })], W)).toMatchObject({ error: "Mon: Ann's time out is before their time in." });
    expect(buildPayload([e({ code: " " })], W)).toMatchObject({ error: "Mon: enter Ann's VRP user code." });
    expect(buildPayload([e({ code: "12-3" })], W)).toMatchObject({ error: expect.stringContaining("letters and numbers") });
    for (const [start, end] of [["07:45", "12:00"], ["13:00", "21:15"], ["09:10", "12:00"]]) {
      expect(buildPayload([e({ start, end })], W)).toMatchObject({ error: expect.stringContaining("between 8:00 AM and 9:00 PM") });
    }
  });
});

describe("VRP codes", () => {
  it("must match per person and not be shared", () => {
    expect(buildPayload([e({ day: 0 }), e({ day: 1, code: "B2" })], W)).toMatchObject({ error: expect.stringContaining("A1 on another day but B2") });
    expect(buildPayload([e({}), e({ day: 2, name: "Bob", code: "A1" })], W)).toMatchObject({ error: expect.stringContaining("already used for someone else") });
    expect(buildPayload([e({ day: 0, code: "a1" }), e({ day: 1, name: "ann", code: "A1 " })], W)).toHaveProperty("shifts");
  });
  it("lists each missing required field", () => {
    expect(missingFields(e({ name: "", code: "", role: "", start: "", end: "" }))).toEqual([]);
    expect(missingFields(e({ code: "", start: "" }))).toEqual(["code", "start"]);
    expect(missingFields(e({ name: " ", role: "", end: "" }))).toEqual(["name", "role", "end"]);
  });
});

describe("times", () => {
  it("offers 15-minute times from 8:00 AM to 9:00 PM", () => {
    expect(TIME_OPTIONS[0]).toBe("08:00");
    expect(TIME_OPTIONS[1]).toBe("08:15");
    expect(TIME_OPTIONS.at(-1)).toBe("21:00");
    expect(TIME_OPTIONS).toHaveLength(53);
  });
  it("counts hours only for complete entries", () => {
    expect(entryHours(e({ start: "09:15", end: "17:45" }))).toBe(8.5);
    expect(entryHours(e({ end: "" }))).toBe(0);
  });
});
