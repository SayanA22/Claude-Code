import type { Task, UserPreferences } from "@/types/db";
import { rankTasks, isBlocked } from "./priority";
import {
  MINUTE,
  type Interval,
  minutesIn,
  roundUpToStep,
  totalMinutes,
} from "./intervals";

/**
 * The deterministic scheduler.
 *
 * It runs in two roles:
 *  1. the fallback planner when no model is configured or the model call fails;
 *  2. the reference the AI plan is repaired against, so a model response can
 *     never produce an overlapping or out-of-hours day.
 *
 * Rules it enforces (mirrored in the planner system prompt):
 *  - nothing overlaps, and nothing lands on a fixed commitment;
 *  - long work is split into focus-length sessions with breaks between;
 *  - same-category work is kept adjacent to limit context switching;
 *  - the day is never filled wall to wall.
 */

export type PlannableTask = Pick<
  Task,
  | "id"
  | "title"
  | "category"
  | "priority"
  | "deadline"
  | "estimated_duration"
  | "postpone_count"
  | "status"
  | "depends_on"
>;

export interface PlannedBlock {
  taskId: string | null;
  title: string;
  kind: "task" | "break";
  start: number; // epoch ms
  end: number;
  reason: string;
}

export interface DeferredTask {
  taskId: string;
  title: string;
  reason: string;
}

export interface GeneratedPlan {
  summary: string;
  blocks: PlannedBlock[];
  deferred: DeferredTask[];
}

export interface GenerateOptions {
  tasks: PlannableTask[];
  free: Interval[];
  preferences: Pick<
    UserPreferences,
    "focus_session_minutes" | "break_minutes" | "estimate_multiplier"
  >;
  now: Date;
  /** Fraction of free time the planner is allowed to fill. */
  fillRatio?: number;
  /** Shortest useful work session. */
  minSessionMinutes?: number;
}

const DEFAULT_FILL_RATIO = 0.82;
const DEFAULT_MIN_SESSION = 15;
/** A task within this score of the leader wins on category adjacency. */
const ADJACENCY_TOLERANCE = 8;

export function generateSchedule(opts: GenerateOptions): GeneratedPlan {
  const {
    tasks,
    free,
    preferences,
    now,
    fillRatio = DEFAULT_FILL_RATIO,
    minSessionMinutes = DEFAULT_MIN_SESSION,
  } = opts;

  const focusLen = Math.max(15, preferences.focus_session_minutes || 45);
  const breakLen = Math.max(0, preferences.break_minutes ?? 10);
  const multiplier = clampMultiplier(preferences.estimate_multiplier);

  const open = tasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  );
  const blocked = open.filter((t) => isBlocked(t, tasks));
  const blockedIds = new Set(blocked.map((t) => t.id));

  const ranked = rankTasks(
    open.filter((t) => !blockedIds.has(t.id)),
    { now, allTasks: tasks },
  );

  const windows = free
    .map((w) => ({ ...w }))
    .filter((w) => minutesIn(w) >= minSessionMinutes)
    .sort((a, b) => a.start - b.start);

  const availableMinutes = totalMinutes(windows);
  const workBudget = Math.floor(availableMinutes * fillRatio);

  const blocks: PlannedBlock[] = [];
  const deferred: DeferredTask[] = [];

  if (!ranked.length) {
    return { summary: emptySummary(availableMinutes), blocks, deferred };
  }
  if (availableMinutes < minSessionMinutes) {
    return {
      summary:
        "There isn't enough open time left today to schedule focused work.",
      blocks,
      deferred: ranked.map((t) => ({
        taskId: t.id,
        title: t.title,
        reason: "No open time left today",
      })),
    };
  }

  // Remaining minutes of work per task, adjusted by the learned multiplier.
  const remaining = new Map<string, number>();
  for (const t of ranked) {
    remaining.set(t.id, Math.max(5, Math.round(t.estimated_duration * multiplier)));
  }

  let windowIndex = 0;
  let cursor = windows.length ? windows[0].start : 0;
  let workScheduled = 0;
  let lastCategory: string | null = null;
  let lastTaskId: string | null = null;

  const isDone = (id: string) => (remaining.get(id) ?? 0) <= 0;

  while (windowIndex < windows.length && workScheduled < workBudget) {
    const win = windows[windowIndex];
    cursor = Math.max(cursor, win.start);
    const gapMinutes = Math.floor((win.end - cursor) / MINUTE);

    if (gapMinutes < minSessionMinutes) {
      windowIndex++;
      if (windowIndex < windows.length) {
        cursor = windows[windowIndex].start;
        // A new window is a natural break; don't carry the streak across it.
        lastCategory = null;
      }
      continue;
    }

    const candidate = pickNext(ranked, remaining, lastCategory, isDone);
    if (!candidate) break;

    const budgetLeft = workBudget - workScheduled;
    const wanted = remaining.get(candidate.id) ?? 0;
    const sessionMinutes = Math.min(
      wanted,
      focusLen,
      gapMinutes,
      Math.max(minSessionMinutes, budgetLeft),
    );

    if (sessionMinutes < Math.min(minSessionMinutes, wanted)) {
      // This window is too small for anything useful; move on.
      windowIndex++;
      if (windowIndex < windows.length) cursor = windows[windowIndex].start;
      continue;
    }

    const start = roundUpToStep(cursor, 5);
    const end = start + sessionMinutes * MINUTE;
    if (end > win.end) {
      windowIndex++;
      if (windowIndex < windows.length) cursor = windows[windowIndex].start;
      continue;
    }

    blocks.push({
      taskId: candidate.id,
      title: candidate.title,
      kind: "task",
      start,
      end,
      reason: reasonFor(candidate, now, wanted > sessionMinutes),
    });

    remaining.set(candidate.id, wanted - sessionMinutes);
    workScheduled += sessionMinutes;
    cursor = end;
    lastCategory = candidate.category;
    lastTaskId = candidate.id;

    // Insert a break when more work is coming and the window can hold it.
    const anyLeft = ranked.some((t) => !isDone(t.id));
    const roomForBreak = (win.end - cursor) / MINUTE >= breakLen + minSessionMinutes;
    if (breakLen > 0 && anyLeft && roomForBreak && workScheduled < workBudget) {
      blocks.push({
        taskId: null,
        title: "Break",
        kind: "break",
        start: cursor,
        end: cursor + breakLen * MINUTE,
        reason: "Reset before the next session",
      });
      cursor += breakLen * MINUTE;
    }
  }

  void lastTaskId;

  for (const t of ranked) {
    const left = remaining.get(t.id) ?? 0;
    if (left <= 0) continue;
    const scheduledSome = blocks.some((b) => b.taskId === t.id);
    deferred.push({
      taskId: t.id,
      title: t.title,
      reason: scheduledSome
        ? `${left} min left over — continue tomorrow`
        : workScheduled >= workBudget
          ? "Day is full — move this to tomorrow"
          : "Not enough open time left today",
    });
  }

  for (const t of blocked) {
    deferred.push({
      taskId: t.id,
      title: t.title,
      reason: "Waiting on another task",
    });
  }

  return {
    summary: buildSummary(blocks, deferred, workScheduled, availableMinutes),
    blocks,
    deferred,
  };
}

/**
 * Choose the next task: highest score, but prefer staying in the current
 * category when the score cost is small.
 */
function pickNext(
  ranked: (PlannableTask & { score: number })[],
  remaining: Map<string, number>,
  lastCategory: string | null,
  isDone: (id: string) => boolean,
): (PlannableTask & { score: number }) | null {
  const open = ranked.filter((t) => !isDone(t.id));
  if (!open.length) return null;

  const leader = open[0];
  if (!lastCategory) return leader;

  const sameCategory = open.find(
    (t) => t.category === lastCategory && leader.score - t.score <= ADJACENCY_TOLERANCE,
  );
  return sameCategory ?? leader;
}

function reasonFor(
  task: PlannableTask,
  now: Date,
  isPartial: boolean,
): string {
  if (task.deadline) {
    const hours = (new Date(task.deadline).getTime() - now.getTime()) / 3_600_000;
    if (hours <= 0) return "Overdue";
    if (hours <= 24) return "Due within a day";
    if (hours <= 72) return "Deadline is close";
  }
  if (task.postpone_count >= 2) return "Postponed more than once";
  if (task.priority === "critical") return "Marked critical";
  if (isPartial) return "First session of a longer task";
  return task.priority === "high" ? "High priority" : "Fits the open time";
}

function buildSummary(
  blocks: PlannedBlock[],
  deferred: DeferredTask[],
  workScheduled: number,
  availableMinutes: number,
): string {
  const sessions = blocks.filter((b) => b.kind === "task").length;
  if (!sessions) {
    return "Nothing fit into today's open time. Try freeing up a window or shortening a task.";
  }
  const hours = Math.round((workScheduled / 60) * 10) / 10;
  const parts = [
    `${sessions} focus ${sessions === 1 ? "session" : "sessions"} (${hours}h) planned across ${Math.round(availableMinutes / 60)}h of open time.`,
  ];
  if (deferred.length) {
    const names = deferred.slice(0, 2).map((d) => d.title).join(" and ");
    parts.push(
      `${names}${deferred.length > 2 ? ` and ${deferred.length - 2} more` : ""} won't fit today — move ${deferred.length > 1 ? "them" : "it"} to tomorrow.`,
    );
  }
  return parts.join(" ");
}

function emptySummary(availableMinutes: number): string {
  return availableMinutes > 0
    ? "Nothing open to schedule. Add a task and plan again."
    : "No open time left today.";
}

function clampMultiplier(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return 1;
  return Math.min(3, Math.max(0.5, value));
}
