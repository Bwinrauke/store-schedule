import { describe, expect, it } from "vitest";
import { addDays, formatHours, formatTime, isIsoDate, shiftHours, weekDays, weekStart } from "./week";

describe("weekStart", () => {
  it("snaps to Sunday by default", () => {
    expect(weekStart("2026-11-24", 0)).toBe("2026-11-22"); // Tue -> Sun
    expect(weekStart("2026-11-22", 0)).toBe("2026-11-22");
  });
  it("snaps to Monday when configured", () => {
    expect(weekStart("2026-11-22", 1)).toBe("2026-11-16"); // Sun -> previous Mon
    expect(weekStart("2026-11-24", 1)).toBe("2026-11-23");
  });
});

describe("dates", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
    expect(weekDays("2026-02-26")).toHaveLength(7);
    expect(weekDays("2026-02-26")[3]).toBe("2026-03-01");
  });
  it("rejects bad dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("garbage")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
  });
});

describe("time", () => {
  it("formats compactly", () => {
    expect(formatTime("09:00:00")).toBe("9a");
    expect(formatTime("12:00")).toBe("12p");
    expect(formatTime("13:30:00")).toBe("1:30p");
    expect(formatTime("00:15")).toBe("12:15a");
  });
  it("nets the break off paid hours", () => {
    expect(shiftHours("09:00", "17:30", 30)).toBe(8);
    expect(shiftHours("10:00", "14:15", 0)).toBe(4.25);
    expect(formatHours(4.25)).toBe("4.25");
    expect(formatHours(4.5)).toBe("4.5");
    expect(formatHours(8)).toBe("8");
  });
});
