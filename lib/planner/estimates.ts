import type { Task } from "@/types/db";

/**
 * Learned duration calibration.
 *
 * If a user consistently needs 60 minutes for work they estimate at 30, future
 * estimates are scaled up. The adjustment is deliberately slow (a 25% step
 * toward the observed ratio) and bounded, so one unusual day can't distort the
 * schedule. This only models how long work takes — nothing else is inferred.
 */

export const MIN_MULTIPLIER = 0.5;
export const MAX_MULTIPLIER = 3;
const LEARNING_RATE = 0.25;
const MIN_SAMPLES = 3;

export interface CompletionSample {
  estimated: number;
  actual: number;
}

export function samplesFromTasks(
  tasks: Pick<Task, "estimated_duration" | "actual_duration" | "status">[],
): CompletionSample[] {
  return tasks
    .filter(
      (t) =>
        t.status === "completed" &&
        typeof t.actual_duration === "number" &&
        t.actual_duration > 0 &&
        t.estimated_duration > 0,
    )
    .map((t) => ({
      estimated: t.estimated_duration,
      actual: t.actual_duration as number,
    }));
}

/**
 * Next multiplier given the current one and recent completions. Returns the
 * current value unchanged until there are enough samples to be meaningful.
 */
export function nextMultiplier(
  current: number,
  samples: CompletionSample[],
): number {
  const usable = samples.filter((s) => s.estimated > 0 && s.actual > 0);
  if (usable.length < MIN_SAMPLES) return round(clamp(current));

  const totalEstimated = usable.reduce((s, x) => s + x.estimated, 0);
  const totalActual = usable.reduce((s, x) => s + x.actual, 0);
  const observed = totalActual / totalEstimated;

  const blended = current + (observed - current) * LEARNING_RATE;
  return round(clamp(blended));
}

/** Apply the multiplier to a raw estimate, rounded to a tidy 5 minutes. */
export function calibrate(minutes: number, multiplier: number): number {
  const scaled = minutes * clamp(multiplier);
  return Math.max(5, Math.round(scaled / 5) * 5);
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, v));
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
