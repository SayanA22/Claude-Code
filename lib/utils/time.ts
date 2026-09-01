/**
 * Timezone-aware date helpers.
 *
 * DayOS stores every instant as UTC (`timestamptz`) but reasons in the user's
 * local day: "today" and "6:00 PM" mean the user's wall clock, not the
 * server's. These helpers convert between the two without pulling in a full
 * timezone library.
 */

const PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = PARTS_FORMATTER_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    PARTS_FORMATTER_CACHE.set(timeZone, fmt);
  }
  return fmt;
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday, in the given zone. */
  weekday: number;
}

/** Falls back to UTC when the stored timezone is not one the runtime knows. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** The wall-clock reading of `date` in `timeZone`. */
export function wallClockIn(date: Date, timeZone: string): WallClock {
  const tz = safeTimeZone(timeZone);
  const parts = partsFormatter(tz).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wc = {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    weekday: 0,
  };
  // Weekday of the *local* calendar date, computed via a UTC proxy so the
  // host timezone can never shift it.
  wc.weekday = new Date(Date.UTC(wc.year, wc.month - 1, wc.day)).getUTCDay();
  return wc;
}

/** Offset in milliseconds of `timeZone` at the instant `date` (east positive). */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const wc = wallClockIn(date, timeZone);
  const asIfUtc = Date.UTC(
    wc.year,
    wc.month - 1,
    wc.day,
    wc.hour,
    wc.minute,
    wc.second,
  );
  // Discard sub-second drift so the result is a clean offset.
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock reading in `timeZone` to the matching UTC instant.
 *
 * Two passes: the first guesses using the offset at the naive instant, the
 * second corrects it when that guess landed on the other side of a DST change.
 */
export function zonedToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let result = naive - zoneOffsetMs(new Date(naive), timeZone);
  const corrected = naive - zoneOffsetMs(new Date(result), timeZone);
  if (corrected !== result) result = corrected;
  return new Date(result);
}

/** "YYYY-MM-DD" for the local calendar day containing `date`. */
export function localDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = wallClockIn(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Parse "YYYY-MM-DD" plus "HH:MM[:SS]" in `timeZone` into a UTC instant. */
export function fromLocalParts(
  dateKey: string,
  time: string,
  timeZone: string,
): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const { hour, minute } = parseTimeOfDay(time);
  return zonedToUtc(timeZone, y, m, d, hour, minute);
}

/** Accepts "18:30", "18:30:00" or "6:30". Clamps out-of-range input. */
export function parseTimeOfDay(time: string): { hour: number; minute: number } {
  const [h = "0", m = "0"] = String(time).split(":");
  return {
    hour: clamp(Number(h) || 0, 0, 23),
    minute: clamp(Number(m) || 0, 0, 59),
  };
}

/** Minutes since local midnight. */
export function minutesOfDay(date: Date, timeZone: string): number {
  const { hour, minute } = wallClockIn(date, timeZone);
  return hour * 60 + minute;
}

/** Shift a "YYYY-MM-DD" key by whole days without timezone drift. */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Whole days between two date keys (`b - a`). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((keyToUtcMidnight(b) - keyToUtcMidnight(a)) / 86_400_000);
}

function keyToUtcMidnight(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Monday-based start of the week containing `dateKey`. */
export function startOfWeekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysToKey(dateKey, -((dow + 6) % 7));
}

/** "4:32 PM" in the user's zone. */
export function formatClock(
  date: Date,
  timeZone: string,
  opts: { showMinutes?: boolean } = {},
): string {
  const { hour, minute } = wallClockIn(date, timeZone);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  if (opts.showMinutes === false && minute === 0) return `${h12} ${suffix}`;
  return `${h12}:${pad(minute)} ${suffix}`;
}

/** "4:45 – 5:20 PM", dropping the redundant first meridiem where possible. */
export function formatRange(start: Date, end: Date, timeZone: string): string {
  const a = wallClockIn(start, timeZone);
  const b = wallClockIn(end, timeZone);
  const sameHalf = a.hour < 12 === b.hour < 12;
  const left = sameHalf
    ? formatClock(start, timeZone).replace(/\s(AM|PM)$/, "")
    : formatClock(start, timeZone);
  return `${left} – ${formatClock(end, timeZone)}`;
}

/** "45m", "1h", "1h 30m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** "Today", "Tomorrow", "Fri", or "Sep 25" for further-out dates. */
export function formatRelativeDay(
  dateKey: string,
  todayKey: string,
  timeZone = "UTC",
): string {
  const diff = daysBetweenKeys(todayKey, dateKey);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const [y, m, d] = dateKey.split("-").map(Number);
  const proxy = new Date(Date.UTC(y, m - 1, d, 12));
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "UTC",
    }).format(proxy);
  }
  void timeZone;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(proxy);
}

export function greetingFor(date: Date, timeZone: string): string {
  const { hour } = wallClockIn(date, timeZone);
  // Before 5am you are up late, not up early — "Good morning" at 2am reads as
  // a bug to the person still awake.
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** "HH:MM" from minutes since midnight. */
export function minutesToTimeString(minutes: number): string {
  const m = clamp(Math.round(minutes), 0, 24 * 60 - 1);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
