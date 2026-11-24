import { describe, expect, it } from "vitest";

import {
  addDays,
  isValidDate,
  startOfWeek,
  toZonedDate,
  toZonedTime,
  todayInZone,
  zonedToUtc,
} from "@/lib/dates";

const NY = "America/New_York";

describe("zonedToUtc", () => {
  it("converts standard and daylight time", () => {
    expect(zonedToUtc("2026-01-15", "08:00", NY).toISOString()).toBe(
      "2026-01-15T13:00:00.000Z",
    );
    expect(zonedToUtc("2026-07-15", "08:00", NY).toISOString()).toBe(
      "2026-07-15T12:00:00.000Z",
    );
  });

  it("handles daylight saving transition days", () => {
    // 2026-03-08: clocks jump from 2:00 to 3:00. 2026-11-01: clocks fall back at 2:00.
    expect(zonedToUtc("2026-03-08", "08:00", NY).toISOString()).toBe(
      "2026-03-08T12:00:00.000Z",
    );
    expect(zonedToUtc("2026-03-08", "00:00", NY).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(zonedToUtc("2026-11-01", "08:00", NY).toISOString()).toBe(
      "2026-11-01T13:00:00.000Z",
    );
  });

  it("round-trips with toZonedDate and toZonedTime", () => {
    const instant = zonedToUtc("2026-11-24", "13:30", NY);
    expect(toZonedDate(instant, NY)).toBe("2026-11-24");
    expect(toZonedTime(instant, NY)).toBe("13:30");
  });
});

describe("calendar dates", () => {
  it("uses the zone for today", () => {
    // 03:00 UTC is still the previous evening in New York.
    expect(todayInZone(NY, new Date("2026-11-25T03:00:00Z"))).toBe(
      "2026-11-24",
    );
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds the Monday of the week", () => {
    expect(startOfWeek("2026-11-24")).toBe("2026-11-23");
    expect(startOfWeek("2026-11-23")).toBe("2026-11-23");
    expect(startOfWeek("2026-11-29")).toBe("2026-11-23");
  });

  it("validates dates", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-2-3")).toBe(false);
  });
});
