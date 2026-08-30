import type { FixedEvent, Profile, ScheduleBlock, UserPreferences } from "@/types/db";
import {
  fromLocalParts,
  parseTimeOfDay,
  safeTimeZone,
  wallClockIn,
  zonedToUtc,
} from "@/lib/utils/time";
import {
  type Interval,
  clipBefore,
  mergeIntervals,
  subtractIntervals,
} from "./intervals";

/**
 * Turns a user's waking hours, declared free windows and fixed commitments
 * into the concrete gaps a planner may fill on one calendar day.
 */

export interface AvailabilityInput {
  dateKey: string; // "YYYY-MM-DD" in the user's zone
  timeZone: string;
  profile: Pick<Profile, "wake_time" | "bed_time">;
  preferences: Pick<UserPreferences, "free_windows">;
  fixedEvents: FixedEvent[];
  /** Blocks already committed for the day that must be preserved. */
  busyBlocks?: Pick<ScheduleBlock, "start_at" | "end_at">[];
  /** Nothing is scheduled before this instant (usually "now"). */
  notBefore?: Date;
}

export interface Availability {
  /** Free gaps the planner may fill, in chronological order. */
  free: Interval[];
  /** The day's outer bound (wake → bed), for rendering the timeline. */
  dayWindow: Interval;
  /** Fixed commitments resolved to concrete instants for this date. */
  fixed: (Interval & { title: string; category: string })[];
}

/** Resolve a fixed event to an interval on `dateKey`, or null if it misses. */
export function resolveFixedEvent(
  event: FixedEvent,
  dateKey: string,
  timeZone: string,
): (Interval & { title: string; category: string }) | null {
  const tz = safeTimeZone(timeZone);

  if (event.start_at && event.end_at) {
    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    const startKey = localKey(start, tz);
    const endKey = localKey(end, tz);
    if (startKey !== dateKey && endKey !== dateKey) return null;
    return {
      start: start.getTime(),
      end: end.getTime(),
      title: event.title,
      category: event.category,
    };
  }

  if (event.recurring_days?.length && event.start_time && event.end_time) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (!event.recurring_days.includes(weekday)) return null;
    const start = fromLocalParts(dateKey, event.start_time, tz);
    const end = fromLocalParts(dateKey, event.end_time, tz);
    if (end.getTime() <= start.getTime()) return null;
    return {
      start: start.getTime(),
      end: end.getTime(),
      title: event.title,
      category: event.category,
    };
  }

  return null;
}

function localKey(date: Date, tz: string): string {
  const wc = wallClockIn(date, tz);
  return `${wc.year}-${String(wc.month).padStart(2, "0")}-${String(
    wc.day,
  ).padStart(2, "0")}`;
}

export function computeAvailability(input: AvailabilityInput): Availability {
  const tz = safeTimeZone(input.timeZone);
  const [y, m, d] = input.dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const wake = parseTimeOfDay(input.profile.wake_time ?? "07:00");
  const bed = parseTimeOfDay(input.profile.bed_time ?? "22:30");

  const dayStart = zonedToUtc(tz, y, m, d, wake.hour, wake.minute);
  // A bedtime earlier than wake time means "after midnight" — roll it forward.
  const bedAfterMidnight =
    bed.hour * 60 + bed.minute <= wake.hour * 60 + wake.minute;
  const dayEnd = zonedToUtc(
    tz,
    y,
    m,
    d + (bedAfterMidnight ? 1 : 0),
    bed.hour,
    bed.minute,
  );

  const dayWindow: Interval = {
    start: dayStart.getTime(),
    end: dayEnd.getTime(),
  };

  // Declared free windows narrow the day further; with none declared the whole
  // waking day is fair game.
  const declared = (input.preferences.free_windows ?? []).filter(
    (w) => !w.days?.length || w.days.includes(weekday),
  );
  const base: Interval[] = declared.length
    ? declared
        .map((w) => ({
          start: Math.max(
            dayWindow.start,
            fromLocalParts(input.dateKey, w.start, tz).getTime(),
          ),
          end: Math.min(
            dayWindow.end,
            fromLocalParts(input.dateKey, w.end, tz).getTime(),
          ),
        }))
        .filter((i) => i.end > i.start)
    : [dayWindow];

  const fixed = input.fixedEvents
    .map((e) => resolveFixedEvent(e, input.dateKey, tz))
    .filter((x): x is Interval & { title: string; category: string } =>
      Boolean(x),
    )
    .sort((a, b) => a.start - b.start);

  const busy: Interval[] = [
    ...fixed.map((f) => ({ start: f.start, end: f.end })),
    ...(input.busyBlocks ?? []).map((b) => ({
      start: new Date(b.start_at).getTime(),
      end: new Date(b.end_at).getTime(),
    })),
  ];

  let free = subtractIntervals(mergeIntervals(base), busy);
  if (input.notBefore) free = clipBefore(free, input.notBefore.getTime());

  return { free, dayWindow, fixed };
}
