import { MINUTE, type Interval, findOverlaps, overlaps } from "./intervals";
import type { PlannedBlock } from "./generate";

/**
 * Guardrail applied to every model-produced schedule.
 *
 * The prompt states the rules; this enforces them. A block is dropped when it
 * references a task that doesn't exist, falls outside the user's free time,
 * lands on a fixed commitment, or collides with a block already accepted.
 * Nothing here invents or moves work — an invalid block is removed and
 * reported, so the user is never shown a plan the system knows is wrong.
 */

export interface RepairInput {
  blocks: PlannedBlock[];
  /** Free gaps the plan is allowed to occupy. */
  free: Interval[];
  /** Ids of the user's real, open tasks. */
  knownTaskIds: Set<string>;
  /** Titles keyed by task id, so a model-supplied title can't rewrite a task. */
  titles: Map<string, string>;
  now: Date;
  minBlockMinutes?: number;
}

export interface RepairResult {
  blocks: PlannedBlock[];
  dropped: { title: string; reason: string }[];
}

export function repairSchedule(input: RepairInput): RepairResult {
  const { blocks, free, knownTaskIds, titles, now, minBlockMinutes = 5 } = input;
  const dropped: RepairResult["dropped"] = [];
  const accepted: PlannedBlock[] = [];

  const sorted = [...blocks].sort((a, b) => a.start - b.start);

  for (const block of sorted) {
    const label = block.title || "Untitled block";

    if (!Number.isFinite(block.start) || !Number.isFinite(block.end)) {
      dropped.push({ title: label, reason: "Invalid time" });
      continue;
    }
    if (block.end - block.start < minBlockMinutes * MINUTE) {
      dropped.push({ title: label, reason: "Too short to be useful" });
      continue;
    }
    if (block.end <= now.getTime()) {
      dropped.push({ title: label, reason: "Already in the past" });
      continue;
    }
    if (block.kind === "task") {
      if (!block.taskId || !knownTaskIds.has(block.taskId)) {
        dropped.push({ title: label, reason: "Not a real task" });
        continue;
      }
    }
    if (!fitsInFreeTime(block, free)) {
      dropped.push({
        title: label,
        reason: "Falls outside your free time or onto a fixed commitment",
      });
      continue;
    }
    if (accepted.some((a) => overlaps(a, block))) {
      dropped.push({ title: label, reason: "Overlaps another block" });
      continue;
    }

    accepted.push({
      ...block,
      // The model may summarise, but the task's own title is authoritative.
      title:
        block.kind === "task" && block.taskId
          ? (titles.get(block.taskId) ?? label)
          : label,
      reason: (block.reason ?? "").slice(0, 240),
    });
  }

  return { blocks: accepted, dropped };
}

/** A block must sit entirely inside one free gap. */
function fitsInFreeTime(block: Interval, free: Interval[]): boolean {
  return free.some((w) => block.start >= w.start && block.end <= w.end);
}

/** Post-condition check used by tests and by the API before persisting. */
export function assertNoOverlaps(blocks: Interval[]): void {
  const clashes = findOverlaps(blocks);
  if (clashes.length) {
    throw new Error(
      `Schedule contains ${clashes.length} overlapping block(s)`,
    );
  }
}
