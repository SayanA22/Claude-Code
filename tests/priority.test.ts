import { describe, expect, it } from "vitest";
import {
  blockingScore,
  effortPressureScore,
  isBlocked,
  postponementScore,
  rankTasks,
  scoreTask,
  urgencyScore,
} from "@/lib/planner/priority";
import type { Task } from "@/types/db";

const NOW = new Date("2025-03-01T12:00:00Z");

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    user_id: "u1",
    project_id: null,
    title: "Task",
    description: null,
    category: "School",
    priority: "medium",
    deadline: null,
    estimated_duration: 30,
    actual_duration: null,
    recurring: null,
    status: "todo",
    notes: null,
    postpone_count: 0,
    depends_on: [],
    completed_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

const hoursFromNow = (h: number) =>
  new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe("urgencyScore", () => {
  it("peaks for overdue work", () => {
    expect(urgencyScore(hoursFromNow(-1), NOW)).toBe(40);
  });

  it("decreases monotonically as the deadline recedes", () => {
    const points = [1, 12, 36, 96, 200, 500, 1000].map((h) =>
      urgencyScore(hoursFromNow(h), NOW),
    );
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeLessThanOrEqual(points[i - 1]);
    }
  });

  it("gives undated work a small but non-zero pull", () => {
    const undated = urgencyScore(null, NOW);
    expect(undated).toBeGreaterThan(0);
    expect(undated).toBeLessThan(urgencyScore(hoursFromNow(24), NOW));
  });
});

describe("effortPressureScore", () => {
  it("weights a big task due soon over a small one", () => {
    const big = effortPressureScore(180, hoursFromNow(24), NOW);
    const small = effortPressureScore(15, hoursFromNow(24), NOW);
    expect(big).toBeGreaterThan(small);
  });

  it("is bounded so it can't dominate the score", () => {
    expect(effortPressureScore(600, hoursFromNow(1), NOW)).toBeLessThanOrEqual(12);
  });
});

describe("postponementScore", () => {
  it("climbs with each push, then caps", () => {
    expect(postponementScore(0)).toBe(0);
    expect(postponementScore(1)).toBeGreaterThan(0);
    expect(postponementScore(2)).toBeGreaterThan(postponementScore(1));
    expect(postponementScore(50)).toBe(10);
  });
});

describe("blockingScore", () => {
  it("pulls forward a task others are waiting on", () => {
    const all = [
      task({ id: "a" }),
      task({ id: "b", depends_on: ["a"] }),
      task({ id: "c", depends_on: ["a"] }),
    ];
    expect(blockingScore("a", all)).toBeGreaterThan(0);
    expect(blockingScore("b", all)).toBe(0);
  });

  it("ignores dependents that are already done", () => {
    const all = [
      task({ id: "a" }),
      task({ id: "b", depends_on: ["a"], status: "completed" }),
    ];
    expect(blockingScore("a", all)).toBe(0);
  });
});

describe("scoreTask", () => {
  it("ranks an urgent low-priority task above a distant high-priority one", () => {
    // The central claim of the scoring model: the user's own label is one
    // input, not the answer.
    const urgentLow = scoreTask(
      task({ priority: "low", deadline: hoursFromNow(3) }),
      { now: NOW },
    );
    const distantHigh = scoreTask(
      task({ priority: "high", deadline: hoursFromNow(24 * 30) }),
      { now: NOW },
    );
    expect(urgentLow.total).toBeGreaterThan(distantHigh.total);
  });

  it("still prefers the higher label when deadlines match", () => {
    const high = scoreTask(
      task({ priority: "high", deadline: hoursFromNow(24) }),
      { now: NOW },
    );
    const low = scoreTask(
      task({ priority: "low", deadline: hoursFromNow(24) }),
      { now: NOW },
    );
    expect(high.total).toBeGreaterThan(low.total);
  });

  it("raises a repeatedly-postponed task above an identical fresh one", () => {
    const pushed = scoreTask(task({ postpone_count: 3 }), { now: NOW });
    const fresh = scoreTask(task({ postpone_count: 0 }), { now: NOW });
    expect(pushed.total).toBeGreaterThan(fresh.total);
  });
});

describe("rankTasks", () => {
  it("orders by score, breaking ties on the earlier deadline", () => {
    const ranked = rankTasks(
      [
        task({ id: "far", priority: "medium", deadline: hoursFromNow(24 * 20) }),
        task({ id: "overdue", priority: "low", deadline: hoursFromNow(-4) }),
        task({ id: "soon", priority: "medium", deadline: hoursFromNow(20) }),
      ],
      { now: NOW },
    );
    expect(ranked.map((t) => t.id)).toEqual(["overdue", "soon", "far"]);
  });

  it("is deterministic for identical tasks", () => {
    const a = task({ id: "a", title: "Alpha" });
    const b = task({ id: "b", title: "Beta" });
    expect(rankTasks([b, a], { now: NOW }).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("isBlocked", () => {
  it("blocks while a dependency is open", () => {
    const all = [task({ id: "a" }), task({ id: "b", depends_on: ["a"] })];
    expect(isBlocked(all[1], all)).toBe(true);
  });

  it("unblocks once the dependency is complete", () => {
    const all = [
      task({ id: "a", status: "completed" }),
      task({ id: "b", depends_on: ["a"] }),
    ];
    expect(isBlocked(all[1], all)).toBe(false);
  });

  it("treats a task with no dependencies as free", () => {
    expect(isBlocked(task(), [])).toBe(false);
  });
});
