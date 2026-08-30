import "server-only";

import type {
  ScheduleBlockWithTask,
  Task,
  WeeklyReviewStats,
} from "@/types/db";
import { addDaysToKey, localDateKey } from "@/lib/utils/time";
import type { ProjectWithProgress } from "./projects";

/**
 * Review statistics, computed from the same rows the rest of the app reads.
 *
 * Nothing here is inferred or estimated — every number is a count or a sum, so
 * the summary the model writes is grounded in something checkable.
 */

export interface DailyStats {
  dateKey: string;
  completedCount: number;
  postponedCount: number;
  plannedMinutes: number;
  actualMinutes: number;
  completedTitles: string[];
  postponedTitles: string[];
  projectsTouched: string[];
  /** Estimated vs actual, for tasks finished today with both recorded. */
  estimateSamples: { title: string; estimated: number; actual: number }[];
}

export function computeDailyStats(
  dateKey: string,
  blocks: ScheduleBlockWithTask[],
  completedToday: Task[],
): DailyStats {
  const work = blocks.filter((b) => b.kind !== "break");

  const plannedMinutes = work.reduce((sum, b) => sum + minutesOf(b), 0);
  const actualMinutes = work
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + minutesOf(b), 0);

  const skipped = work.filter(
    (b) => b.status === "skipped" || b.status === "planned",
  );

  return {
    dateKey,
    completedCount: completedToday.length,
    postponedCount: skipped.length,
    plannedMinutes,
    actualMinutes,
    completedTitles: completedToday.map((t) => t.title),
    postponedTitles: skipped.map((b) => b.title),
    projectsTouched: Array.from(
      new Set(
        completedToday
          .map((t) => t.project_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
    estimateSamples: completedToday
      .filter((t) => t.actual_duration && t.estimated_duration)
      .map((t) => ({
        title: t.title,
        estimated: t.estimated_duration,
        actual: t.actual_duration as number,
      })),
  };
}

export function computeWeeklyStats(args: {
  weekStart: string;
  blocks: ScheduleBlockWithTask[];
  completed: Task[];
  openTasks: Task[];
  projects: ProjectWithProgress[];
  timeZone: string;
  now: Date;
}): WeeklyReviewStats {
  const work = args.blocks.filter((b) => b.kind !== "break");
  const planned = work.length;
  const completedBlocks = work.filter((b) => b.status === "completed").length;

  const todayKey = localDateKey(args.now, args.timeZone);
  const weekEnd = addDaysToKey(args.weekStart, 7);

  const upcoming = args.openTasks
    .filter((t) => t.deadline)
    .map((t) => ({ title: t.title, deadline: t.deadline as string }))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 6);

  const mostPostponed = args.openTasks
    .filter((t) => t.postpone_count > 0)
    .sort((a, b) => b.postpone_count - a.postpone_count)
    .slice(0, 5)
    .map((t) => ({ title: t.title, count: t.postpone_count }));

  void todayKey;
  void weekEnd;

  return {
    completed: args.completed.length,
    planned,
    completionRate: planned
      ? Math.round((completedBlocks / planned) * 100)
      : 0,
    plannedMinutes: work.reduce((sum, b) => sum + minutesOf(b), 0),
    actualMinutes: work
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + minutesOf(b), 0),
    mostPostponed,
    upcomingDeadlines: upcoming,
    projectProgress: args.projects.map((p) => ({
      title: p.title,
      progress: p.progress,
    })),
  };
}

function minutesOf(block: { start_at: string; end_at: string }): number {
  return Math.max(
    0,
    Math.round(
      (new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) /
        60_000,
    ),
  );
}
