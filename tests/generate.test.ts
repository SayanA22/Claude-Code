import { describe, expect, it } from "vitest";
import { generateSchedule, type PlannableTask } from "@/lib/planner/generate";
import { findOverlaps, totalMinutes } from "@/lib/planner/intervals";
import { computeAvailability } from "@/lib/planner/availability";
import { fromLocalParts } from "@/lib/utils/time";

const TZ = "America/New_York";
const DATE = "2025-03-05";
const at = (time: string) => fromLocalParts(DATE, time, TZ).getTime();

const prefs = {
  focus_session_minutes: 45,
  break_minutes: 10,
  estimate_multiplier: 1,
};

function task(overrides: Partial<PlannableTask> = {}): PlannableTask {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Task",
    category: "School",
    priority: "medium",
    deadline: null,
    estimated_duration: 45,
    postpone_count: 0,
    status: "todo",
    depends_on: [],
    ...overrides,
  };
}

const NOW = new Date(at("16:00"));
const EVENING = [{ start: at("16:00"), end: at("21:00") }];

describe("generateSchedule", () => {
  it("never produces overlapping blocks", () => {
    const plan = generateSchedule({
      tasks: [
        task({ id: "a", title: "APHUG notes", estimated_duration: 45 }),
        task({ id: "b", title: "Math study", estimated_duration: 60 }),
        task({ id: "c", title: "Piano", estimated_duration: 30, category: "Music" }),
        task({ id: "d", title: "Workout", estimated_duration: 45, category: "Fitness" }),
      ],
      free: EVENING,
      preferences: prefs,
      now: NOW,
    });

    expect(plan.blocks.length).toBeGreaterThan(0);
    expect(findOverlaps(plan.blocks)).toEqual([]);
  });

  it("keeps every block inside the free windows it was given", () => {
    const free = [
      { start: at("16:00"), end: at("17:00") },
      { start: at("19:00"), end: at("21:00") },
    ];
    const plan = generateSchedule({
      tasks: [
        task({ id: "a", estimated_duration: 60 }),
        task({ id: "b", estimated_duration: 90 }),
      ],
      free,
      preferences: prefs,
      now: NOW,
    });

    for (const block of plan.blocks) {
      expect(
        free.some((w) => block.start >= w.start && block.end <= w.end),
      ).toBe(true);
    }
  });

  it("schedules the deadline-driven task first", () => {
    const plan = generateSchedule({
      tasks: [
        task({
          id: "later",
          title: "Later",
          deadline: new Date(at("16:00") + 20 * 86_400_000).toISOString(),
        }),
        task({
          id: "tomorrow",
          title: "Due tomorrow",
          deadline: new Date(at("16:00") + 16 * 3_600_000).toISOString(),
        }),
      ],
      free: EVENING,
      preferences: prefs,
      now: NOW,
    });

    const first = plan.blocks.find((b) => b.kind === "task");
    expect(first?.taskId).toBe("tomorrow");
  });

  it("splits work longer than a focus session into several sessions", () => {
    const plan = generateSchedule({
      tasks: [task({ id: "long", estimated_duration: 120 })],
      free: EVENING,
      preferences: prefs,
      now: NOW,
    });

    const sessions = plan.blocks.filter((b) => b.taskId === "long");
    expect(sessions.length).toBeGreaterThan(1);
    for (const session of sessions) {
      expect((session.end - session.start) / 60_000).toBeLessThanOrEqual(45);
    }
  });

  it("puts a break between consecutive sessions", () => {
    const plan = generateSchedule({
      tasks: [
        task({ id: "a", estimated_duration: 45 }),
        task({ id: "b", estimated_duration: 45 }),
      ],
      free: EVENING,
      preferences: prefs,
      now: NOW,
    });
    expect(plan.blocks.some((b) => b.kind === "break")).toBe(true);
  });

  it("leaves the day some slack rather than filling it wall to wall", () => {
    const plan = generateSchedule({
      tasks: Array.from({ length: 12 }, (_, i) =>
        task({ id: `t${i}`, title: `Task ${i}`, estimated_duration: 60 }),
      ),
      free: EVENING,
      preferences: prefs,
      now: NOW,
    });

    const worked = plan.blocks
      .filter((b) => b.kind === "task")
      .reduce((sum, b) => sum + (b.end - b.start) / 60_000, 0);
    expect(worked).toBeLessThan(totalMinutes(EVENING));
  });

  it("says explicitly what has to move when the day is full", () => {
    const plan = generateSchedule({
      tasks: Array.from({ length: 10 }, (_, i) =>
        task({ id: `t${i}`, title: `Task ${i}`, estimated_duration: 60 }),
      ),
      free: [{ start: at("16:00"), end: at("18:00") }],
      preferences: prefs,
      now: NOW,
    });

    expect(plan.deferred.length).toBeGreaterThan(0);
    for (const item of plan.deferred) {
      expect(item.reason).toBeTruthy();
      expect(item.title).toBeTruthy();
    }
  });

  it("never schedules a task that is waiting on another", () => {
    const plan = generateSchedule({
      tasks: [
        task({ id: "first", title: "First" }),
        task({ id: "second", title: "Second", depends_on: ["first"] }),
      ],
      free: EVENING,
      preferences: prefs,
      now: NOW,
    });

    expect(plan.blocks.some((b) => b.taskId === "second")).toBe(false);
    expect(plan.deferred.some((d) => d.taskId === "second")).toBe(true);
  });

  it("keeps same-category work together to limit context switching", () => {
    const plan = generateSchedule({
      tasks: [
        task({ id: "s1", title: "History", category: "School" }),
        task({ id: "m1", title: "Piano", category: "Music" }),
        task({ id: "s2", title: "Biology", category: "School" }),
      ],
      free: EVENING,
      preferences: prefs,
      now: NOW,
    });

    const categories = plan.blocks
      .filter((b) => b.kind === "task")
      .map((b) => (b.taskId?.startsWith("s") ? "School" : "Music"));
    // Two School blocks should not be separated by the Music one.
    const switches = categories.filter((c, i) => i > 0 && c !== categories[i - 1]).length;
    expect(switches).toBeLessThanOrEqual(1);
  });

  it("scales sessions by the learned estimate multiplier", () => {
    const optimistic = generateSchedule({
      tasks: [task({ id: "a", estimated_duration: 30 })],
      free: EVENING,
      preferences: { ...prefs, estimate_multiplier: 1 },
      now: NOW,
    });
    const realistic = generateSchedule({
      tasks: [task({ id: "a", estimated_duration: 30 })],
      free: EVENING,
      preferences: { ...prefs, estimate_multiplier: 1.5 },
      now: NOW,
    });

    const minutes = (plan: typeof optimistic) =>
      plan.blocks
        .filter((b) => b.kind === "task")
        .reduce((sum, b) => sum + (b.end - b.start) / 60_000, 0);

    expect(minutes(realistic)).toBeGreaterThan(minutes(optimistic));
  });

  it("returns an honest empty plan when there is no time left", () => {
    const plan = generateSchedule({
      tasks: [task({ id: "a" })],
      free: [],
      preferences: prefs,
      now: NOW,
    });

    expect(plan.blocks).toEqual([]);
    expect(plan.deferred).toHaveLength(1);
    expect(plan.summary).toMatch(/open time/i);
  });

  it("ignores completed tasks", () => {
    const plan = generateSchedule({
      tasks: [task({ id: "done", status: "completed" })],
      free: EVENING,
      preferences: prefs,
      now: NOW,
    });
    expect(plan.blocks).toEqual([]);
  });

  it("plans a realistic student evening end to end", () => {
    // The scenario from the product spec: five tasks, one evening.
    const availability = computeAvailability({
      dateKey: DATE,
      timeZone: TZ,
      profile: { wake_time: "07:00:00", bed_time: "22:30:00" },
      preferences: { free_windows: [] },
      fixedEvents: [
        {
          id: "school",
          user_id: "u1",
          title: "School",
          category: "School",
          start_at: null,
          end_at: null,
          recurring_days: [1, 2, 3, 4, 5],
          start_time: "08:00",
          end_time: "15:20",
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
      notBefore: NOW,
    });

    const plan = generateSchedule({
      tasks: [
        task({
          id: "aphug",
          title: "APHUG assignment",
          estimated_duration: 45,
          priority: "high",
          deadline: new Date(at("16:00") + 16 * 3_600_000).toISOString(),
        }),
        task({ id: "math", title: "Math test study", estimated_duration: 60, priority: "critical" }),
        task({ id: "piano", title: "Piano practice", estimated_duration: 30, category: "Music" }),
        task({ id: "ball", title: "Basketball workout", estimated_duration: 45, category: "Fitness" }),
        task({ id: "code", title: "Coding project", estimated_duration: 60, category: "Coding" }),
      ],
      free: availability.free,
      preferences: prefs,
      now: NOW,
    });

    expect(findOverlaps(plan.blocks)).toEqual([]);
    expect(plan.blocks.filter((b) => b.kind === "task").length).toBeGreaterThanOrEqual(4);
    // Nothing lands during school hours.
    for (const block of plan.blocks) {
      expect(block.start).toBeGreaterThanOrEqual(at("16:00"));
      expect(block.end).toBeLessThanOrEqual(at("22:30"));
    }
    expect(plan.summary).toBeTruthy();
  });
});
