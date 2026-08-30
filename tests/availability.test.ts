import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  resolveFixedEvent,
} from "@/lib/planner/availability";
import { totalMinutes } from "@/lib/planner/intervals";
import { fromLocalParts } from "@/lib/utils/time";
import type { FixedEvent, Profile, UserPreferences } from "@/types/db";

const TZ = "America/New_York";
const DATE = "2025-03-05"; // a Wednesday

const profile = {
  wake_time: "07:00:00",
  bed_time: "22:30:00",
} as Pick<Profile, "wake_time" | "bed_time">;

const prefs = (free: UserPreferences["free_windows"] = []) =>
  ({ free_windows: free }) as Pick<UserPreferences, "free_windows">;

function recurring(overrides: Partial<FixedEvent> = {}): FixedEvent {
  return {
    id: "f1",
    user_id: "u1",
    title: "School",
    category: "School",
    start_at: null,
    end_at: null,
    recurring_days: [1, 2, 3, 4, 5],
    start_time: "08:00",
    end_time: "15:20",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

const localMs = (time: string, dateKey = DATE) =>
  fromLocalParts(dateKey, time, TZ).getTime();

describe("resolveFixedEvent", () => {
  it("resolves a weekly event on a matching weekday", () => {
    const resolved = resolveFixedEvent(recurring(), DATE, TZ);
    expect(resolved).not.toBeNull();
    expect(resolved?.start).toBe(localMs("08:00"));
    expect(resolved?.end).toBe(localMs("15:20"));
  });

  it("skips a weekly event on a non-matching weekday", () => {
    // 2025-03-08 is a Saturday.
    expect(resolveFixedEvent(recurring(), "2025-03-08", TZ)).toBeNull();
  });

  it("resolves a one-off event on its own day only", () => {
    const oneOff = recurring({
      recurring_days: [],
      start_time: null,
      end_time: null,
      start_at: new Date(localMs("18:00")).toISOString(),
      end_at: new Date(localMs("19:30")).toISOString(),
    });
    expect(resolveFixedEvent(oneOff, DATE, TZ)).not.toBeNull();
    expect(resolveFixedEvent(oneOff, "2025-03-06", TZ)).toBeNull();
  });
});

describe("computeAvailability", () => {
  it("returns the whole waking day when nothing is declared or booked", () => {
    const { free, dayWindow } = computeAvailability({
      dateKey: DATE,
      timeZone: TZ,
      profile,
      preferences: prefs(),
      fixedEvents: [],
    });
    expect(free).toEqual([dayWindow]);
    expect(totalMinutes(free)).toBe(15 * 60 + 30);
  });

  it("removes fixed commitments from the day", () => {
    const { free } = computeAvailability({
      dateKey: DATE,
      timeZone: TZ,
      profile,
      preferences: prefs(),
      fixedEvents: [recurring()],
    });
    expect(free).toEqual([
      { start: localMs("07:00"), end: localMs("08:00") },
      { start: localMs("15:20"), end: localMs("22:30") },
    ]);
  });

  it("never leaves free time inside a fixed commitment", () => {
    const { free, fixed } = computeAvailability({
      dateKey: DATE,
      timeZone: TZ,
      profile,
      preferences: prefs(),
      fixedEvents: [
        recurring(),
        recurring({ id: "f2", title: "Practice", recurring_days: [3], start_time: "16:00", end_time: "17:45" }),
      ],
    });

    for (const window of free) {
      for (const commitment of fixed) {
        expect(
          window.start < commitment.end && commitment.start < window.end,
        ).toBe(false);
      }
    }
  });

  it("narrows the day to declared free windows", () => {
    const { free } = computeAvailability({
      dateKey: DATE,
      timeZone: TZ,
      profile,
      preferences: prefs([{ days: [1, 2, 3, 4, 5], start: "16:00", end: "21:00" }]),
      fixedEvents: [],
    });
    expect(free).toEqual([{ start: localMs("16:00"), end: localMs("21:00") }]);
  });

  it("falls back to the whole day when no declared window covers the weekday", () => {
    // Saturday: the weekday free window doesn't apply, so the day opens up
    // rather than collapsing to nothing.
    const { free } = computeAvailability({
      dateKey: "2025-03-08",
      timeZone: TZ,
      profile,
      preferences: prefs([{ days: [1, 2, 3, 4, 5], start: "16:00", end: "21:00" }]),
      fixedEvents: [],
    });
    expect(totalMinutes(free)).toBe(15 * 60 + 30);
  });

  it("excludes work already on the schedule", () => {
    const { free } = computeAvailability({
      dateKey: DATE,
      timeZone: TZ,
      profile,
      preferences: prefs(),
      fixedEvents: [],
      busyBlocks: [
        {
          start_at: new Date(localMs("09:00")).toISOString(),
          end_at: new Date(localMs("10:00")).toISOString(),
        },
      ],
    });
    expect(free).toEqual([
      { start: localMs("07:00"), end: localMs("09:00") },
      { start: localMs("10:00"), end: localMs("22:30") },
    ]);
  });

  it("never offers time before now", () => {
    const { free } = computeAvailability({
      dateKey: DATE,
      timeZone: TZ,
      profile,
      preferences: prefs(),
      fixedEvents: [],
      notBefore: new Date(localMs("16:30")),
    });
    expect(free).toEqual([{ start: localMs("16:30"), end: localMs("22:30") }]);
  });

  it("treats a past-midnight bedtime as part of the same day", () => {
    const { dayWindow } = computeAvailability({
      dateKey: DATE,
      timeZone: TZ,
      profile: { wake_time: "08:00:00", bed_time: "01:00:00" },
      preferences: prefs(),
      fixedEvents: [],
    });
    expect(dayWindow.end).toBe(localMs("01:00", "2025-03-06"));
  });
});
