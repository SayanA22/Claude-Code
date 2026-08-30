import type { ScheduleBlockWithTask, Task } from "@/types/db";

/**
 * "What should I be doing right now?" — computed from the day's blocks and the
 * user's open tasks.
 *
 * This is deliberately pure and synchronous: the Today screen re-derives it on
 * every tick of the clock without touching the database.
 */

export type DayStatus =
  | "unplanned" // nothing scheduled today yet
  | "in_progress" // a block is running right now
  | "on_track" // planned, between blocks, nothing overdue
  | "behind" // a planned block's window has passed unfinished
  | "free" // planned, but nothing left today
  | "done"; // everything scheduled is finished

export interface DayState {
  status: DayStatus;
  /** One short sentence for the top of the Today screen. */
  statusLine: string;
  /** The block happening now, if any. */
  currentBlock: ScheduleBlockWithTask | null;
  /** The next planned block after now. */
  nextBlock: ScheduleBlockWithTask | null;
  /** What the "Up next" card should show — current if running, else next. */
  focusBlock: ScheduleBlockWithTask | null;
  /** Planned blocks whose window has passed without being finished. */
  missedBlocks: ScheduleBlockWithTask[];
  /** Open tasks whose deadline has already passed. */
  overdueTasks: Task[];
  /** Open tasks due within the next 48 hours. */
  dueSoonTasks: Task[];
  plannedMinutes: number;
  completedMinutes: number;
  completedCount: number;
  remainingCount: number;
}

const MINUTE = 60_000;
const DUE_SOON_MS = 48 * 3_600_000;

export function computeDayState(
  blocks: ScheduleBlockWithTask[],
  openTasks: Task[],
  now: Date,
): DayState {
  const t = now.getTime();
  const taskBlocks = blocks.filter((b) => b.kind !== "break");

  const currentBlock =
    taskBlocks.find(
      (b) =>
        new Date(b.start_at).getTime() <= t &&
        new Date(b.end_at).getTime() > t &&
        b.status !== "completed" &&
        b.status !== "skipped",
    ) ?? null;

  const nextBlock =
    taskBlocks
      .filter(
        (b) =>
          new Date(b.start_at).getTime() > t &&
          b.status !== "completed" &&
          b.status !== "skipped",
      )
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )[0] ?? null;

  const missedBlocks = taskBlocks.filter(
    (b) =>
      new Date(b.end_at).getTime() <= t &&
      (b.status === "planned" || b.status === "in_progress"),
  );

  const overdueTasks = openTasks.filter(
    (task) => task.deadline && new Date(task.deadline).getTime() < t,
  );

  const dueSoonTasks = openTasks.filter((task) => {
    if (!task.deadline) return false;
    const d = new Date(task.deadline).getTime();
    return d >= t && d <= t + DUE_SOON_MS;
  });

  const plannedMinutes = taskBlocks.reduce((sum, b) => sum + durationOf(b), 0);
  const completedBlocks = taskBlocks.filter((b) => b.status === "completed");
  const completedMinutes = completedBlocks.reduce(
    (sum, b) => sum + durationOf(b),
    0,
  );
  const remainingCount = taskBlocks.filter(
    (b) => b.status === "planned" || b.status === "in_progress",
  ).length;

  const status = deriveStatus({
    hasBlocks: taskBlocks.length > 0,
    currentBlock,
    nextBlock,
    missedCount: missedBlocks.length,
    remainingCount,
  });

  return {
    status,
    statusLine: statusLineFor(status, {
      missedCount: missedBlocks.length,
      remainingCount,
      overdueCount: overdueTasks.length,
      openCount: openTasks.length,
    }),
    currentBlock,
    nextBlock,
    focusBlock: currentBlock ?? nextBlock,
    missedBlocks,
    overdueTasks,
    dueSoonTasks,
    plannedMinutes,
    completedMinutes,
    completedCount: completedBlocks.length,
    remainingCount,
  };
}

function durationOf(block: { start_at: string; end_at: string }): number {
  return Math.max(
    0,
    Math.round(
      (new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) /
        MINUTE,
    ),
  );
}

function deriveStatus(input: {
  hasBlocks: boolean;
  currentBlock: ScheduleBlockWithTask | null;
  nextBlock: ScheduleBlockWithTask | null;
  missedCount: number;
  remainingCount: number;
}): DayStatus {
  if (!input.hasBlocks) return "unplanned";
  if (input.missedCount > 0) return "behind";
  if (input.currentBlock) return "in_progress";
  if (input.remainingCount === 0) return "done";
  if (!input.nextBlock) return "free";
  return "on_track";
}

function statusLineFor(
  status: DayStatus,
  counts: {
    missedCount: number;
    remainingCount: number;
    overdueCount: number;
    openCount: number;
  },
): string {
  switch (status) {
    case "unplanned":
      return counts.openCount > 0
        ? "Your day isn't planned yet."
        : "Nothing on your plate yet.";
    case "behind":
      return counts.missedCount === 1
        ? "You're running behind on one session."
        : `You're running behind on ${counts.missedCount} sessions.`;
    case "in_progress":
      return "You're on track.";
    case "done":
      return "Everything you planned is done.";
    case "free":
      return "You're free right now.";
    default:
      return counts.overdueCount > 0
        ? `On track — but ${counts.overdueCount} ${counts.overdueCount === 1 ? "task is" : "tasks are"} past due.`
        : "You're on track.";
  }
}
