import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  daysBetweenKeys,
  formatDuration,
  formatRange,
  formatRelativeDay,
  fromLocalParts,
  localDateKey,
  minutesOfDay,
  parseTimeOfDay,
  startOfWeekKey,
  wallClockIn,
  zonedToUtc,
} from "@/lib/utils/time";

const NY = "America/New_York";
const TOKYO = "Asia/Tokyo";

describe("wallClockIn", () => {
  it("reads the local clock, not the host clock", () => {
    // 2025-03-01T05:30Z is 00:30 in New York and 14:30 in Tokyo.
    const instant = new Date("2025-03-01T05:30:00Z");

    expect(wallClockIn(instant, NY)).toMatchObject({
      year: 2025,
      month: 3,
      day: 1,
      hour: 0,
      minute: 30,
    });
    expect(wallClockIn(instant, TOKYO)).toMatchObject({
      year: 2025,
      month: 3,
      day: 1,
      hour: 14,
      minute: 30,
    });
  });

  it("reports the weekday of the local date", () => {
    // Still Saturday night in New York; already Sunday afternoon in Tokyo.
    const instant = new Date("2025-03-02T04:00:00Z");
    expect(wallClockIn(instant, NY).weekday).toBe(6); // Saturday
    expect(wallClockIn(instant, TOKYO).weekday).toBe(0); // Sunday
  });

  it("falls back to UTC for an unknown timezone", () => {
    const instant = new Date("2025-03-01T05:30:00Z");
    expect(wallClockIn(instant, "Not/AZone").hour).toBe(5);
  });
});

describe("zonedToUtc", () => {
  it("converts a wall clock reading to the right instant", () => {
    // 09:00 in New York on 1 March 2025 (EST, UTC-5) is 14:00 UTC.
    expect(zonedToUtc(NY, 2025, 3, 1, 9, 0).toISOString()).toBe(
      "2025-03-01T14:00:00.000Z",
    );
  });

  it("handles the spring-forward transition", () => {
    // US DST begins 09 March 2025. 09:00 local afterwards is EDT (UTC-4).
    expect(zonedToUtc(NY, 2025, 3, 10, 9, 0).toISOString()).toBe(
      "2025-03-10T13:00:00.000Z",
    );
    // The day before, the same wall time is EST (UTC-5).
    expect(zonedToUtc(NY, 2025, 3, 8, 9, 0).toISOString()).toBe(
      "2025-03-08T14:00:00.000Z",
    );
  });

  it("handles the autumn fall-back transition", () => {
    // DST ends 02 November 2025.
    expect(zonedToUtc(NY, 2025, 11, 3, 9, 0).toISOString()).toBe(
      "2025-11-03T14:00:00.000Z",
    );
  });

  it("round-trips through localDateKey", () => {
    const instant = zonedToUtc(TOKYO, 2025, 6, 15, 23, 30);
    expect(localDateKey(instant, TOKYO)).toBe("2025-06-15");
  });
});

describe("localDateKey", () => {
  it("uses the user's day boundary, not UTC's", () => {
    // 23:00 in New York on 1 March is already 2 March in UTC.
    const instant = new Date("2025-03-02T04:00:00Z");
    expect(localDateKey(instant, NY)).toBe("2025-03-01");
    expect(localDateKey(instant, "UTC")).toBe("2025-03-02");
  });
});

describe("fromLocalParts", () => {
  it("parses HH:MM in the user's zone", () => {
    expect(fromLocalParts("2025-03-01", "16:45", NY).toISOString()).toBe(
      "2025-03-01T21:45:00.000Z",
    );
  });

  it("accepts an HH:MM:SS time from Postgres", () => {
    expect(fromLocalParts("2025-03-01", "16:45:00", NY).toISOString()).toBe(
      "2025-03-01T21:45:00.000Z",
    );
  });
});

describe("date key arithmetic", () => {
  it("adds days across a month boundary", () => {
    expect(addDaysToKey("2025-01-31", 1)).toBe("2025-02-01");
    expect(addDaysToKey("2025-03-01", -1)).toBe("2025-02-28");
    expect(addDaysToKey("2024-02-28", 1)).toBe("2024-02-29"); // leap year
  });

  it("counts days between keys", () => {
    expect(daysBetweenKeys("2025-03-01", "2025-03-08")).toBe(7);
    expect(daysBetweenKeys("2025-03-08", "2025-03-01")).toBe(-7);
    // Spans a DST change: still a whole number of calendar days.
    expect(daysBetweenKeys("2025-03-08", "2025-03-10")).toBe(2);
  });

  it("finds the Monday of a week", () => {
    expect(startOfWeekKey("2025-03-05")).toBe("2025-03-03"); // Wed → Mon
    expect(startOfWeekKey("2025-03-03")).toBe("2025-03-03"); // Mon → itself
    expect(startOfWeekKey("2025-03-02")).toBe("2025-02-24"); // Sun → prior Mon
  });
});

describe("formatting", () => {
  it("formats durations the way a person says them", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(0)).toBe("0m");
  });

  it("drops the redundant meridiem within one half of the day", () => {
    const start = new Date("2025-03-01T21:45:00Z"); // 16:45 in NY
    const end = new Date("2025-03-01T22:20:00Z"); // 17:20 in NY
    expect(formatRange(start, end, NY)).toBe("4:45 – 5:20 PM");
  });

  it("keeps both meridiems when a range crosses noon", () => {
    const start = new Date("2025-03-01T16:30:00Z"); // 11:30 AM NY
    const end = new Date("2025-03-01T18:00:00Z"); // 1:00 PM NY
    expect(formatRange(start, end, NY)).toBe("11:30 AM – 1:00 PM");
  });

  it("names near days relatively", () => {
    expect(formatRelativeDay("2025-03-01", "2025-03-01")).toBe("Today");
    expect(formatRelativeDay("2025-03-02", "2025-03-01")).toBe("Tomorrow");
    expect(formatRelativeDay("2025-02-28", "2025-03-01")).toBe("Yesterday");
    expect(formatRelativeDay("2025-04-20", "2025-03-01")).toBe("Apr 20");
  });
});

describe("parseTimeOfDay", () => {
  it("clamps nonsense rather than throwing", () => {
    expect(parseTimeOfDay("25:99")).toEqual({ hour: 23, minute: 59 });
    expect(parseTimeOfDay("")).toEqual({ hour: 0, minute: 0 });
  });
});

describe("minutesOfDay", () => {
  it("counts from local midnight", () => {
    expect(minutesOfDay(new Date("2025-03-01T21:45:00Z"), NY)).toBe(
      16 * 60 + 45,
    );
  });
});
