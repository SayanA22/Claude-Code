import type { Recurrence } from "@/types/db";
import { addDaysToKey, fromLocalParts, localDateKey } from "@/lib/utils/time";

/**
 * Recurring tasks.
 *
 * DayOS doesn't materialise a series in advance — a calendar full of
 * hypothetical piano practice is noise, and it makes "what's left today?"
 * meaningless. Instead, completing a recurring task creates exactly one
 * successor, so there is always precisely one open instance.
 */

/** The next occurrence's deadline, or null if the task doesn't repeat. */
export function nextOccurrence(
  recurring: Recurrence,
  from: Date,
  timeZone: string,
  time = "23:59",
): string | null {
  if (!recurring) return null;

  const fromKey = localDateKey(from, timeZone);
  const nextKey = nextDateKey(recurring, fromKey);
  if (!nextKey) return null;

  return fromLocalParts(nextKey, time, timeZone).toISOString();
}

/** Pure date-key arithmetic, so the rules are testable on their own. */
export function nextDateKey(
  recurring: Recurrence,
  fromKey: string,
): string | null {
  switch (recurring) {
    case "daily":
      return addDaysToKey(fromKey, 1);
    case "weekly":
      return addDaysToKey(fromKey, 7);
    case "weekdays": {
      // Skip forward to the next Monday–Friday.
      let candidate = addDaysToKey(fromKey, 1);
      for (let i = 0; i < 7; i++) {
        if (isWeekday(candidate)) return candidate;
        candidate = addDaysToKey(candidate, 1);
      }
      return candidate;
    }
    default:
      return null;
  }
}

function isWeekday(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}
