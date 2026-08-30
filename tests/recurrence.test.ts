import { describe, expect, it } from "vitest";
import { nextDateKey, nextOccurrence } from "@/lib/planner/recurrence";
import { fromLocalParts } from "@/lib/utils/time";

describe("nextDateKey", () => {
  it("advances a daily task by one day", () => {
    expect(nextDateKey("daily", "2025-03-05")).toBe("2025-03-06");
  });

  it("advances a weekly task by seven days", () => {
    expect(nextDateKey("weekly", "2025-03-05")).toBe("2025-03-12");
  });

  it("skips the weekend for a weekday task", () => {
    // Friday 7 March → Monday 10 March.
    expect(nextDateKey("weekdays", "2025-03-07")).toBe("2025-03-10");
    // Saturday → Monday.
    expect(nextDateKey("weekdays", "2025-03-08")).toBe("2025-03-10");
    // Midweek is just the next day.
    expect(nextDateKey("weekdays", "2025-03-05")).toBe("2025-03-06");
  });

  it("crosses a month boundary", () => {
    expect(nextDateKey("daily", "2025-03-31")).toBe("2025-04-01");
  });

  it("returns null for a task that doesn't repeat", () => {
    expect(nextDateKey(null, "2025-03-05")).toBeNull();
  });
});

describe("nextOccurrence", () => {
  const TZ = "America/New_York";

  it("keeps the original time of day in the user's zone", () => {
    const from = fromLocalParts("2025-03-05", "18:00", TZ);
    const next = nextOccurrence("daily", from, TZ, "18:00");
    expect(next).toBe(fromLocalParts("2025-03-06", "18:00", TZ).toISOString());
  });

  it("holds the wall-clock time across a DST change", () => {
    // 8 March → 9 March, when US clocks spring forward. 18:00 stays 18:00
    // locally, which is a different UTC instant.
    const from = fromLocalParts("2025-03-08", "18:00", TZ);
    const next = nextOccurrence("daily", from, TZ, "18:00");
    expect(next).toBe(fromLocalParts("2025-03-09", "18:00", TZ).toISOString());
    expect(next).toBe("2025-03-09T22:00:00.000Z"); // EDT, not EST
  });

  it("returns null when the task doesn't repeat", () => {
    expect(nextOccurrence(null, new Date(), TZ)).toBeNull();
  });
});
