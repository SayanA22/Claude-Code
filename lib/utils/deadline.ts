import type { ParsedTask } from "@/lib/validation/task";
import { addDaysToKey, fromLocalParts } from "./time";

/**
 * Resolves a model's *relative* deadline into an absolute instant.
 *
 * Models are asked for offsets ("1 day from today") rather than dates, so
 * calendar and timezone arithmetic happens here, once, where it's testable.
 * A day with no stated time means end of that day — what a student means by
 * "due Friday".
 */
export function resolveRelativeDeadline(
  parsed: Pick<ParsedTask, "deadline_days_from_today" | "deadline_time">,
  todayKey: string,
  timeZone: string,
): string | null {
  return deadlineFromOffset(
    parsed.deadline_days_from_today,
    todayKey,
    timeZone,
    parsed.deadline_time,
  );
}

/** The same conversion, for callers that only have a day offset. */
export function deadlineFromOffset(
  daysFromToday: number | null | undefined,
  todayKey: string,
  timeZone: string,
  time?: string | null,
): string | null {
  if (daysFromToday == null) return null;
  return fromLocalParts(
    addDaysToKey(todayKey, daysFromToday),
    time || "23:59",
    timeZone,
  ).toISOString();
}
