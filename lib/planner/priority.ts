import type { Task, TaskPriority } from "@/types/db";

/**
 * Internal priority scoring.
 *
 * The user's own label is one input among several, not the answer: a "low"
 * task due in two hours outranks a "high" one due next month. Every component
 * is bounded so no single factor can dominate, and the weights are exported so
 * the tests and the AI prompt describe the same model.
 */

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 34,
  high: 25,
  medium: 15,
  low: 7,
};

export interface ScoreBreakdown {
  userPriority: number;
  urgency: number;
  effortPressure: number;
  postponement: number;
  blocking: number;
  total: number;
}

export interface ScoreContext {
  now: Date;
  /** All of the user's open tasks — used to detect blocked dependents. */
  allTasks?: Pick<Task, "id" | "depends_on" | "status">[];
}

const HOUR = 3_600_000;

/**
 * Urgency from deadline proximity, on a 0–40 curve.
 *
 * Overdue pins at the top; a deadline a month out contributes almost nothing.
 */
export function urgencyScore(
  deadline: string | null,
  now: Date,
): number {
  if (!deadline) return 6; // Undated work still deserves some pull.
  const hoursLeft = (new Date(deadline).getTime() - now.getTime()) / HOUR;
  if (Number.isNaN(hoursLeft)) return 6;
  if (hoursLeft <= 0) return 40; // Overdue.
  if (hoursLeft <= 6) return 36;
  if (hoursLeft <= 24) return 31;
  if (hoursLeft <= 48) return 24;
  if (hoursLeft <= 24 * 5) return 17;
  if (hoursLeft <= 24 * 10) return 11;
  if (hoursLeft <= 24 * 21) return 6;
  return 3;
}

/**
 * How much of the remaining time this task would consume.
 *
 * A 3-hour task due tomorrow is more pressing than a 15-minute one due at the
 * same moment, because it needs a bigger slot found for it sooner.
 */
export function effortPressureScore(
  estimatedMinutes: number,
  deadline: string | null,
  now: Date,
): number {
  if (!deadline) return Math.min(4, estimatedMinutes / 60);
  const hoursLeft = (new Date(deadline).getTime() - now.getTime()) / HOUR;
  if (Number.isNaN(hoursLeft) || hoursLeft <= 0) return 12;
  // Assume roughly 5 usable hours per day between now and the deadline.
  const usableHours = Math.max(1, (hoursLeft / 24) * 5);
  const ratio = estimatedMinutes / 60 / usableHours;
  return Math.min(12, Math.round(ratio * 24 * 10) / 10);
}

/** Repeatedly-pushed work climbs, so it stops being invisible. */
export function postponementScore(postponeCount: number): number {
  return Math.min(10, postponeCount * 3.5);
}

/** Tasks other open tasks depend on get pulled forward. */
export function blockingScore(
  taskId: string,
  allTasks: Pick<Task, "id" | "depends_on" | "status">[] | undefined,
): number {
  if (!allTasks?.length) return 0;
  const dependents = allTasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.status !== "archived" &&
      t.depends_on?.includes(taskId),
  ).length;
  return Math.min(8, dependents * 4);
}

export function scoreTask(
  task: Pick<
    Task,
    "id" | "priority" | "deadline" | "estimated_duration" | "postpone_count"
  >,
  ctx: ScoreContext,
): ScoreBreakdown {
  const userPriority = PRIORITY_WEIGHT[task.priority] ?? PRIORITY_WEIGHT.medium;
  const urgency = urgencyScore(task.deadline, ctx.now);
  const effortPressure = effortPressureScore(
    task.estimated_duration,
    task.deadline,
    ctx.now,
  );
  const postponement = postponementScore(task.postpone_count ?? 0);
  const blocking = blockingScore(task.id, ctx.allTasks);

  return {
    userPriority,
    urgency,
    effortPressure,
    postponement,
    blocking,
    total:
      Math.round(
        (userPriority + urgency + effortPressure + postponement + blocking) * 10,
      ) / 10,
  };
}

/** Highest score first; ties broken by the earlier deadline, then title. */
export function rankTasks<
  T extends Pick<
    Task,
    | "id"
    | "title"
    | "priority"
    | "deadline"
    | "estimated_duration"
    | "postpone_count"
  >,
>(tasks: T[], ctx: ScoreContext): (T & { score: number })[] {
  return tasks
    .map((task) => ({ ...task, score: scoreTask(task, ctx).total }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (da !== db) return da - db;
      return a.title.localeCompare(b.title);
    });
}

/**
 * A task is blocked while any task it depends on is still open. Blocked tasks
 * are never scheduled, however urgent they look.
 */
export function isBlocked(
  task: Pick<Task, "depends_on">,
  allTasks: Pick<Task, "id" | "status">[],
): boolean {
  if (!task.depends_on?.length) return false;
  const openIds = new Set(
    allTasks
      .filter((t) => t.status !== "completed" && t.status !== "archived")
      .map((t) => t.id),
  );
  return task.depends_on.some((id) => openIds.has(id));
}
