import "server-only";

import type { Task } from "@/types/db";
import { scoreTask } from "@/lib/planner/priority";
import type { Interval } from "@/lib/planner/intervals";
import {
  formatClock,
  formatDuration,
  localDateKey,
  daysBetweenKeys,
} from "@/lib/utils/time";

/**
 * Renders DayOS state into the compact, unambiguous text the model reads.
 *
 * Two conventions run through all of it: times are the user's wall clock (the
 * server does every timezone conversion), and deadlines are given both as a
 * date and as "in N days", so the model never has to do calendar arithmetic.
 */

export interface TaskLine {
  id: string;
  line: string;
}

export function describeTask(
  task: Task,
  now: Date,
  timeZone: string,
  allTasks: Task[],
): string {
  const score = scoreTask(task, { now, allTasks }).total;
  const parts = [
    `- id=${task.id}`,
    `title=${JSON.stringify(task.title)}`,
    `category=${task.category}`,
    `priority=${task.priority}`,
    `score=${score}`,
    `estimate=${task.estimated_duration}m`,
  ];

  if (task.deadline) {
    const todayKey = localDateKey(now, timeZone);
    const dueKey = localDateKey(new Date(task.deadline), timeZone);
    const days = daysBetweenKeys(todayKey, dueKey);
    const when =
      days < 0
        ? `OVERDUE by ${Math.abs(days)}d`
        : days === 0
          ? "due today"
          : days === 1
            ? "due tomorrow"
            : `due in ${days}d`;
    parts.push(
      `deadline=${dueKey} ${formatClock(new Date(task.deadline), timeZone)} (${when})`,
    );
  } else {
    parts.push("deadline=none");
  }

  if (task.postpone_count > 0) parts.push(`postponed=${task.postpone_count}x`);
  if (task.status === "in_progress") parts.push("status=in_progress");
  if (task.project_id) parts.push(`project=${task.project_id}`);
  if (task.notes) parts.push(`notes=${JSON.stringify(task.notes.slice(0, 160))}`);

  return parts.join(" ");
}

export function describeTasks(
  tasks: Task[],
  now: Date,
  timeZone: string,
): string {
  if (!tasks.length) return "(none)";
  return tasks.map((t) => describeTask(t, now, timeZone, tasks)).join("\n");
}

export function describeWindows(free: Interval[], timeZone: string): string {
  if (!free.length) return "(no free time left today)";
  return free
    .map(
      (w) =>
        `- ${formatClock(new Date(w.start), timeZone)} to ${formatClock(
          new Date(w.end),
          timeZone,
        )} (${formatDuration((w.end - w.start) / 60000)})`,
    )
    .join("\n");
}

export function describeFixed(
  fixed: { start: number; end: number; title: string; category: string }[],
  timeZone: string,
): string {
  if (!fixed.length) return "(none today)";
  return fixed
    .map(
      (f) =>
        `- ${formatClock(new Date(f.start), timeZone)}–${formatClock(
          new Date(f.end),
          timeZone,
        )} ${f.title} [${f.category}]`,
    )
    .join("\n");
}

export function describeBlocks(
  blocks: { start_at: string; end_at: string; title: string; status: string }[],
  timeZone: string,
): string {
  if (!blocks.length) return "(nothing yet today)";
  return blocks
    .map(
      (b) =>
        `- ${formatClock(new Date(b.start_at), timeZone)}–${formatClock(
          new Date(b.end_at),
          timeZone,
        )} ${b.title} [${b.status}]`,
    )
    .join("\n");
}
