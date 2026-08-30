import type {
  NotificationPrefs,
  ScheduleBlockWithTask,
  Task,
} from "@/types/db";
import { formatClock, minutesOfDay, parseTimeOfDay } from "@/lib/utils/time";

/**
 * What DayOS would tell you, and when.
 *
 * Pure and transport-agnostic: this decides *which* notifications a day earns.
 * Delivery is a separate concern — today the browser's Notification API for an
 * installed PWA, later a push service or an iOS client, without changing this.
 *
 * The rule that matters most here is restraint. A student who gets pinged for
 * everything turns notifications off, and then the useful one never lands.
 */

export type NotificationKind =
  | "session_start"
  | "day_remaining"
  | "deadline_warning";

export interface PlannedNotification {
  /** Stable across re-computation, so a notification is never sent twice. */
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** When to deliver it. */
  at: Date;
  /** Where tapping it should land. */
  href: string;
}

export interface NotificationInput {
  blocks: ScheduleBlockWithTask[];
  tasks: Task[];
  prefs: NotificationPrefs;
  now: Date;
  timeZone: string;
}

/** How far ahead of a session to warn. */
const SESSION_LEAD_MINUTES = 10;
/** At most this many notifications per day, whatever the data says. */
export const DAILY_CAP = 6;

export function computeNotifications(
  input: NotificationInput,
): PlannedNotification[] {
  if (!input.prefs?.enabled) return [];

  const planned: PlannedNotification[] = [];
  const nowMs = input.now.getTime();

  if (input.prefs.sessionStart) {
    for (const block of input.blocks) {
      if (block.kind === "break" || block.status !== "planned") continue;
      const start = new Date(block.start_at);
      const at = new Date(start.getTime() - SESSION_LEAD_MINUTES * 60_000);
      if (at.getTime() <= nowMs) continue;

      planned.push({
        id: `session:${block.id}`,
        kind: "session_start",
        title: `${block.title} starts in ${SESSION_LEAD_MINUTES} minutes`,
        body: `${formatClock(start, input.timeZone)} · ${block.task?.category ?? "Focus"}`,
        at,
        href: `/focus/${block.id}`,
      });
    }
  }

  if (input.prefs.deadlineWarnings) {
    for (const task of input.tasks) {
      if (!task.deadline) continue;
      const due = new Date(task.deadline).getTime();
      // One warning, a day out — not a countdown.
      const at = new Date(due - 24 * 3_600_000);
      if (at.getTime() <= nowMs || due <= nowMs) continue;

      planned.push({
        id: `deadline:${task.id}`,
        kind: "deadline_warning",
        title: `${task.title} is due tomorrow`,
        body: task.category,
        at,
        href: "/today",
      });
    }
  }

  if (input.prefs.dailyPlanReminder) {
    const remaining = input.blocks.filter(
      (b) => b.kind !== "break" && b.status === "planned",
    );
    const important = input.tasks.filter(
      (t) => t.priority === "critical" || t.priority === "high",
    );

    if (remaining.length >= 2 && important.length > 0) {
      // One nudge, mid-evening, only if the day still has real work in it.
      const at = eveningCheckIn(input.now, input.timeZone);
      if (at && at.getTime() > nowMs) {
        planned.push({
          id: `remaining:${dayKeyOf(input.now, input.timeZone)}`,
          kind: "day_remaining",
          title: `${important.length} important ${important.length === 1 ? "task" : "tasks"} left today`,
          body: "Open DayOS to pick the next one.",
          at,
          href: "/today",
        });
      }
    }
  }

  return planned
    .filter((n) => !isQuiet(n.at, input.prefs, input.timeZone))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, DAILY_CAP);
}

/** True when `date` falls inside the user's quiet hours. */
export function isQuiet(
  date: Date,
  prefs: NotificationPrefs,
  timeZone: string,
): boolean {
  const quiet = prefs.quietHours;
  if (!quiet?.start || !quiet?.end) return false;

  const minute = minutesOfDay(date, timeZone);
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);

  // Quiet hours usually wrap midnight (22:00 → 07:00).
  return start <= end
    ? minute >= start && minute < end
    : minute >= start || minute < end;
}

function toMinutes(time: string): number {
  const { hour, minute } = parseTimeOfDay(time);
  return hour * 60 + minute;
}

/** 7pm local, if that's still ahead. */
function eveningCheckIn(now: Date, timeZone: string): Date | null {
  const minutes = minutesOfDay(now, timeZone);
  const target = 19 * 60;
  if (minutes >= target) return null;
  return new Date(now.getTime() + (target - minutes) * 60_000);
}

function dayKeyOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
