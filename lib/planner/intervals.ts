/** Half-open time intervals `[start, end)` in epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

export const MINUTE = 60_000;

export function minutesIn(interval: Interval): number {
  return Math.max(0, Math.round((interval.end - interval.start) / MINUTE));
}

/** True when the two intervals share any instant. Touching endpoints do not. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Every unordered pair of overlapping intervals, by original index.
 *
 * A planned day holds a few dozen blocks at most, so the quadratic scan is
 * both cheaper and easier to trust than a sweep line.
 */
export function findOverlaps(intervals: Interval[]): [number, number][] {
  const clashes: [number, number][] = [];
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      if (overlaps(intervals[i], intervals[j])) clashes.push([i, j]);
    }
  }
  return clashes;
}

/** Sort and coalesce overlapping/adjacent intervals. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals]
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/** `base` minus every interval in `busy`, as a sorted list of free gaps. */
export function subtractIntervals(
  base: Interval[],
  busy: Interval[],
): Interval[] {
  const blocked = mergeIntervals(busy);
  const free: Interval[] = [];

  for (const window of mergeIntervals(base)) {
    let cursor = window.start;
    for (const b of blocked) {
      if (b.end <= cursor) continue;
      if (b.start >= window.end) break;
      if (b.start > cursor) {
        free.push({ start: cursor, end: Math.min(b.start, window.end) });
      }
      cursor = Math.max(cursor, b.end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) free.push({ start: cursor, end: window.end });
  }

  return free.filter((i) => i.end > i.start);
}

/** Total free minutes across a set of intervals. */
export function totalMinutes(intervals: Interval[]): number {
  return intervals.reduce((sum, i) => sum + minutesIn(i), 0);
}

/** Clip intervals so none starts before `from`. */
export function clipBefore(intervals: Interval[], from: number): Interval[] {
  return intervals
    .map((i) => ({ start: Math.max(i.start, from), end: i.end }))
    .filter((i) => i.end > i.start);
}

/** Round an instant up to the next `step`-minute boundary. */
export function roundUpToStep(ms: number, step = 5): number {
  const stepMs = step * MINUTE;
  return Math.ceil(ms / stepMs) * stepMs;
}
