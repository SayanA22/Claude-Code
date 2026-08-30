import { describe, expect, it } from "vitest";
import { computeDayState } from "@/lib/planner/now";
import type { ScheduleBlockWithTask, Task } from "@/types/db";

const H = 3_600_000;
const NOW = new Date("2025-03-05T21:00:00Z"); // 16:00 New York

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    user_id: "u1",
    project_id: null,
    title: "APHUG notes",
    description: null,
    category: "School",
    priority: "medium",
    deadline: null,
    estimated_duration: 45,
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

function block(overrides: Partial<ScheduleBlockWithTask> = {}): ScheduleBlockWithTask {
  return {
    id: overrides.id ?? "b1",
    user_id: "u1",
    task_id: "t1",
    title: "APHUG notes",
    kind: "task",
    status: "planned",
    start_at: new Date(NOW.getTime() + H).toISOString(),
    end_at: new Date(NOW.getTime() + 2 * H).toISOString(),
    local_date: "2025-03-05",
    reason: "Due tomorrow",
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    task: task(),
    ...overrides,
  };
}

describe("computeDayState", () => {
  it("reports an unplanned day", () => {
    const state = computeDayState([], [task()], NOW);
    expect(state.status).toBe("unplanned");
    expect(state.statusLine).toMatch(/isn't planned/i);
    expect(state.focusBlock).toBeNull();
  });

  it("surfaces the block happening right now", () => {
    const running = block({
      start_at: new Date(NOW.getTime() - 10 * 60_000).toISOString(),
      end_at: new Date(NOW.getTime() + 20 * 60_000).toISOString(),
    });
    const state = computeDayState([running], [task()], NOW);
    expect(state.status).toBe("in_progress");
    expect(state.currentBlock?.id).toBe(running.id);
    expect(state.focusBlock?.id).toBe(running.id);
  });

  it("falls back to the next block when nothing is running", () => {
    const state = computeDayState([block()], [task()], NOW);
    expect(state.currentBlock).toBeNull();
    expect(state.focusBlock?.id).toBe("b1");
    expect(state.status).toBe("on_track");
  });

  it("picks the earliest upcoming block", () => {
    const later = block({
      id: "later",
      start_at: new Date(NOW.getTime() + 4 * H).toISOString(),
      end_at: new Date(NOW.getTime() + 5 * H).toISOString(),
    });
    const state = computeDayState([later, block()], [task()], NOW);
    expect(state.nextBlock?.id).toBe("b1");
  });

  it("reports running behind when a session's window has passed", () => {
    const missed = block({
      id: "missed",
      start_at: new Date(NOW.getTime() - 3 * H).toISOString(),
      end_at: new Date(NOW.getTime() - 2 * H).toISOString(),
    });
    const state = computeDayState([missed, block()], [task()], NOW);
    expect(state.status).toBe("behind");
    expect(state.missedBlocks).toHaveLength(1);
    expect(state.statusLine).toMatch(/behind/i);
  });

  it("does not count completed or skipped blocks as missed", () => {
    const done = block({
      id: "done",
      status: "completed",
      start_at: new Date(NOW.getTime() - 3 * H).toISOString(),
      end_at: new Date(NOW.getTime() - 2 * H).toISOString(),
    });
    const skipped = block({
      id: "skipped",
      status: "skipped",
      start_at: new Date(NOW.getTime() - 2 * H).toISOString(),
      end_at: new Date(NOW.getTime() - H).toISOString(),
    });
    const state = computeDayState([done, skipped], [], NOW);
    expect(state.missedBlocks).toEqual([]);
    expect(state.status).toBe("done");
  });

  it("separates overdue tasks from ones due soon", () => {
    const overdue = task({ id: "od", deadline: new Date(NOW.getTime() - H).toISOString() });
    const soon = task({ id: "soon", deadline: new Date(NOW.getTime() + 20 * H).toISOString() });
    const later = task({ id: "later", deadline: new Date(NOW.getTime() + 200 * H).toISOString() });

    const state = computeDayState([], [overdue, soon, later], NOW);
    expect(state.overdueTasks.map((t) => t.id)).toEqual(["od"]);
    expect(state.dueSoonTasks.map((t) => t.id)).toEqual(["soon"]);
  });

  it("counts planned and completed minutes, ignoring breaks", () => {
    const done = block({
      id: "done",
      status: "completed",
      start_at: new Date(NOW.getTime() - 2 * H).toISOString(),
      end_at: new Date(NOW.getTime() - H).toISOString(),
    });
    const brk = block({ id: "brk", kind: "break", task: null, task_id: null });
    const state = computeDayState([done, brk, block()], [task()], NOW);

    expect(state.plannedMinutes).toBe(120);
    expect(state.completedMinutes).toBe(60);
    expect(state.completedCount).toBe(1);
  });

  it("says the day is done when everything scheduled is finished", () => {
    const done = block({
      id: "done",
      status: "completed",
      start_at: new Date(NOW.getTime() - 2 * H).toISOString(),
      end_at: new Date(NOW.getTime() - H).toISOString(),
    });
    const state = computeDayState([done], [], NOW);
    expect(state.status).toBe("done");
    expect(state.statusLine).toMatch(/done/i);
  });
});
