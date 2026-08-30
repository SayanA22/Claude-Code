import { describe, expect, it } from "vitest";
import {
  clipBefore,
  findOverlaps,
  mergeIntervals,
  minutesIn,
  overlaps,
  roundUpToStep,
  subtractIntervals,
  totalMinutes,
} from "@/lib/planner/intervals";

const M = 60_000;
const at = (minutes: number) => minutes * M;
const span = (start: number, end: number) => ({ start: at(start), end: at(end) });

describe("overlaps", () => {
  it("detects a genuine overlap", () => {
    expect(overlaps(span(0, 60), span(30, 90))).toBe(true);
  });

  it("treats touching endpoints as not overlapping", () => {
    // Back-to-back sessions are legal; a schedule of them is valid.
    expect(overlaps(span(0, 60), span(60, 120))).toBe(false);
  });

  it("detects full containment", () => {
    expect(overlaps(span(0, 120), span(30, 60))).toBe(true);
  });

  it("is symmetric", () => {
    expect(overlaps(span(30, 90), span(0, 60))).toBe(true);
  });
});

describe("findOverlaps", () => {
  it("returns nothing for a clean schedule", () => {
    expect(findOverlaps([span(0, 60), span(60, 120), span(180, 200)])).toEqual(
      [],
    );
  });

  it("finds every colliding pair, by original index", () => {
    const clashes = findOverlaps([span(0, 60), span(30, 90), span(45, 50)]);
    expect(clashes).toContainEqual([0, 1]);
    expect(clashes).toContainEqual([0, 2]);
    expect(clashes).toContainEqual([1, 2]);
    expect(clashes).toHaveLength(3);
  });

  it("finds an overlap even when the earlier block encloses a later one", () => {
    // A long block followed by two short ones inside it: a naive sweep that
    // stops at the first non-overlap would miss the second.
    const clashes = findOverlaps([span(0, 240), span(10, 20), span(200, 210)]);
    expect(clashes).toHaveLength(2);
  });
});

describe("mergeIntervals", () => {
  it("coalesces overlapping and touching spans", () => {
    expect(mergeIntervals([span(0, 60), span(50, 90), span(90, 120)])).toEqual([
      span(0, 120),
    ]);
  });

  it("keeps genuinely separate spans apart", () => {
    expect(mergeIntervals([span(0, 60), span(120, 180)])).toHaveLength(2);
  });

  it("drops empty spans", () => {
    expect(mergeIntervals([span(30, 30)])).toEqual([]);
  });
});

describe("subtractIntervals", () => {
  it("carves a busy block out of the middle of a window", () => {
    expect(subtractIntervals([span(0, 240)], [span(60, 120)])).toEqual([
      span(0, 60),
      span(120, 240),
    ]);
  });

  it("removes a window swallowed entirely by a commitment", () => {
    expect(subtractIntervals([span(60, 120)], [span(0, 240)])).toEqual([]);
  });

  it("trims from the edges", () => {
    expect(subtractIntervals([span(0, 240)], [span(0, 60), span(200, 300)])).toEqual([
      span(60, 200),
    ]);
  });

  it("handles several overlapping commitments", () => {
    const free = subtractIntervals(
      [span(0, 600)],
      [span(60, 120), span(100, 180), span(400, 420)],
    );
    expect(free).toEqual([span(0, 60), span(180, 400), span(420, 600)]);
  });

  it("returns the whole window when nothing is busy", () => {
    expect(subtractIntervals([span(0, 120)], [])).toEqual([span(0, 120)]);
  });
});

describe("clipBefore", () => {
  it("drops time already in the past and trims the current window", () => {
    expect(clipBefore([span(0, 60), span(120, 180)], at(30))).toEqual([
      span(30, 60),
      span(120, 180),
    ]);
  });
});

describe("totals and rounding", () => {
  it("sums free minutes", () => {
    expect(totalMinutes([span(0, 60), span(120, 150)])).toBe(90);
    expect(minutesIn(span(0, 45))).toBe(45);
  });

  it("rounds up to a tidy boundary", () => {
    expect(roundUpToStep(at(31), 5)).toBe(at(35));
    expect(roundUpToStep(at(30), 5)).toBe(at(30));
  });
});
