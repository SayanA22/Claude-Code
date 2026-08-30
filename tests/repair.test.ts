import { describe, expect, it } from "vitest";
import { assertNoOverlaps, repairSchedule } from "@/lib/planner/repair";
import type { PlannedBlock } from "@/lib/planner/generate";

const H = 3_600_000;
const BASE = Date.UTC(2025, 2, 5, 21, 0); // 16:00 in New York
const NOW = new Date(BASE);

const free = [{ start: BASE, end: BASE + 5 * H }];

function block(overrides: Partial<PlannedBlock> = {}): PlannedBlock {
  return {
    taskId: "task-1",
    title: "APHUG notes",
    kind: "task",
    start: BASE + H,
    end: BASE + 2 * H,
    reason: "Due tomorrow",
    ...overrides,
  };
}

const known = new Set(["task-1", "task-2"]);
const titles = new Map([
  ["task-1", "APHUG notes"],
  ["task-2", "Math study"],
]);

const repair = (blocks: PlannedBlock[]) =>
  repairSchedule({ blocks, free, knownTaskIds: known, titles, now: NOW });

describe("repairSchedule", () => {
  it("accepts a valid plan unchanged", () => {
    const result = repair([
      block(),
      block({ taskId: "task-2", title: "Math study", start: BASE + 2 * H, end: BASE + 3 * H }),
    ]);
    expect(result.blocks).toHaveLength(2);
    expect(result.dropped).toEqual([]);
  });

  it("drops a block referencing a task the user doesn't have", () => {
    const result = repair([block({ taskId: "invented" })]);
    expect(result.blocks).toEqual([]);
    expect(result.dropped[0].reason).toMatch(/not a real task/i);
  });

  it("drops a block that falls outside the free windows", () => {
    const result = repair([
      block({ start: BASE + 10 * H, end: BASE + 11 * H }),
    ]);
    expect(result.blocks).toEqual([]);
    expect(result.dropped[0].reason).toMatch(/free time|fixed commitment/i);
  });

  it("drops a block that only partly fits a free window", () => {
    const result = repair([block({ start: BASE + 4 * H, end: BASE + 6 * H })]);
    expect(result.blocks).toEqual([]);
  });

  it("keeps the first of two overlapping blocks and drops the second", () => {
    const result = repair([
      block({ start: BASE + H, end: BASE + 3 * H }),
      block({ taskId: "task-2", start: BASE + 2 * H, end: BASE + 4 * H }),
    ]);
    expect(result.blocks).toHaveLength(1);
    expect(result.dropped[0].reason).toMatch(/overlap/i);
    expect(assertNoOverlaps(result.blocks)).toBeUndefined();
  });

  it("drops a block already in the past", () => {
    const result = repair([
      block({ start: BASE - 3 * H, end: BASE - 2 * H }),
    ]);
    expect(result.blocks).toEqual([]);
    expect(result.dropped[0].reason).toMatch(/past/i);
  });

  it("drops a block too short to be useful", () => {
    const result = repair([
      block({ start: BASE + H, end: BASE + H + 60_000 }),
    ]);
    expect(result.blocks).toEqual([]);
    expect(result.dropped[0].reason).toMatch(/short/i);
  });

  it("drops a block with an unusable timestamp", () => {
    const result = repair([block({ start: NaN, end: NaN })]);
    expect(result.blocks).toEqual([]);
    expect(result.dropped[0].reason).toMatch(/invalid/i);
  });

  it("takes the task's real title over whatever the model called it", () => {
    // A model must not be able to rename a task by titling a block.
    const result = repair([block({ title: "Something else entirely" })]);
    expect(result.blocks[0].title).toBe("APHUG notes");
  });

  it("allows a break with no task id", () => {
    const result = repair([
      block({ kind: "break", taskId: null, title: "Break" }),
    ]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].title).toBe("Break");
  });

  it("caps an over-long reason instead of rejecting the block", () => {
    const result = repair([block({ reason: "x".repeat(1000) })]);
    expect(result.blocks[0].reason.length).toBeLessThanOrEqual(240);
  });
});

describe("assertNoOverlaps", () => {
  it("throws when a schedule double-books", () => {
    expect(() =>
      assertNoOverlaps([
        { start: 0, end: 100 },
        { start: 50, end: 150 },
      ]),
    ).toThrow(/overlapping/i);
  });

  it("passes a clean schedule", () => {
    expect(() =>
      assertNoOverlaps([
        { start: 0, end: 100 },
        { start: 100, end: 200 },
      ]),
    ).not.toThrow();
  });
});
