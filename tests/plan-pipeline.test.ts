import { describe, expect, it } from "vitest";
import {
  buildPlan,
  loadPlanContext,
  persistPlan,
} from "@/lib/planner/plan-day";
import { findOverlaps } from "@/lib/planner/intervals";
import { fromLocalParts } from "@/lib/utils/time";
import type { GeneratedPlan } from "@/lib/planner/generate";
import type {
  FixedEvent,
  Profile,
  ScheduleBlock,
  Task,
  UserPreferences,
} from "@/types/db";

/**
 * The planning pipeline end to end, against a fake Supabase client.
 *
 * This is the scenario the product is judged on: a real student evening with
 * five tasks, planned, then replanned after something slips. It exercises
 * `loadPlanContext → buildPlan → persistPlan` including the repair pass, with
 * no database and no model.
 */

const TZ = "America/New_York";
const DATE = "2025-03-05"; // Wednesday
const at = (time: string, date = DATE) => fromLocalParts(date, time, TZ);
const NOW = at("16:00");

const profile: Profile = {
  id: "u1",
  full_name: "Alex",
  timezone: TZ,
  wake_time: "07:00:00",
  bed_time: "22:30:00",
  school_label: "Lincoln High",
  areas: ["School", "Sports", "Music", "Coding"],
  onboarded: true,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

const preferences: UserPreferences = {
  user_id: "u1",
  focus_session_minutes: 45,
  break_minutes: 10,
  energy_peak: "evening",
  free_windows: [],
  estimate_multiplier: 1,
  notifications: {
    enabled: true,
    sessionStart: true,
    dailyPlanReminder: true,
    deadlineWarnings: true,
    quietHours: { start: "22:00", end: "07:00" },
  },
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

function task(
  id: string,
  title: string,
  minutes: number,
  overrides: Partial<Task> = {},
): Task {
  return {
    id,
    user_id: "u1",
    project_id: null,
    title,
    description: null,
    category: "School",
    priority: "medium",
    deadline: null,
    estimated_duration: minutes,
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

/** The five tasks from the product's own acceptance scenario. */
const TASKS: Task[] = [
  task("aphug", "AP Human Geography assignment", 45, {
    priority: "high",
    deadline: at("08:30", "2025-03-06").toISOString(),
  }),
  task("math", "Study for Friday math test", 60, {
    priority: "critical",
    deadline: at("08:00", "2025-03-07").toISOString(),
  }),
  task("piano", "Piano practice", 30, { category: "Music" }),
  task("ball", "Basketball workout", 45, { category: "Fitness" }),
  task("code", "Work on coding project", 60, { category: "Coding" }),
];

const SCHOOL: FixedEvent = {
  id: "school",
  user_id: "u1",
  title: "School",
  category: "School",
  start_at: null,
  end_at: null,
  recurring_days: [1, 2, 3, 4, 5],
  start_time: "08:00",
  end_time: "15:20",
  created_at: NOW.toISOString(),
};

/**
 * The slice of the Supabase client the planner uses: `.from(table)` with
 * `select` filters, `delete`, and `insert`.
 */
function fakeSupabase(state: {
  tasks: Task[];
  fixedEvents: FixedEvent[];
  blocks: ScheduleBlock[];
}) {
  const inserted: Record<string, unknown>[] = [];
  const deleted: string[] = [];

  const client = {
    from(table: string) {
      const rows =
        table === "tasks"
          ? state.tasks
          : table === "fixed_events"
            ? state.fixedEvents
            : state.blocks;

      const builder = {
        _rows: rows as unknown[],
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        in(column: string, values: string[]) {
          if (column === "id") {
            deleted.push(...values);
            state.blocks = state.blocks.filter((b) => !values.includes(b.id));
          }
          return builder;
        },
        delete() {
          return builder;
        },
        insert(payload: Record<string, unknown>[]) {
          inserted.push(...payload);
          state.blocks = [
            ...state.blocks,
            ...payload.map((row, i) => ({
              ...(row as unknown as ScheduleBlock),
              id: `new-${state.blocks.length + i}`,
            })),
          ];
          return Promise.resolve({ data: payload, error: null });
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve({ data: builder._rows, error: null }).then(
            resolve,
          );
        },
      };
      return builder;
    },
  };

  return { client, inserted, deleted, state };
}

async function contextFor(state: {
  tasks: Task[];
  fixedEvents: FixedEvent[];
  blocks: ScheduleBlock[];
}) {
  const fake = fakeSupabase(state);
  const ctx = await loadPlanContext(
    // The fake implements the narrow surface the planner uses.
    fake.client as never,
    {
      userId: "u1",
      profile,
      preferences,
      timeZone: TZ,
      dateKey: DATE,
      now: NOW,
    },
  );
  return { ctx, fake };
}

describe("plan pipeline", () => {
  it("plans a student evening without overlaps or school-hours clashes", async () => {
    const { ctx } = await contextFor({
      tasks: TASKS,
      fixedEvents: [SCHOOL],
      blocks: [],
    });

    const { plan, source } = await buildPlan(ctx);

    expect(source).toBe("builtin");
    expect(findOverlaps(plan.blocks)).toEqual([]);
    expect(plan.blocks.filter((b) => b.kind === "task").length).toBeGreaterThanOrEqual(4);

    for (const block of plan.blocks) {
      expect(block.start).toBeGreaterThanOrEqual(at("16:00").getTime());
      expect(block.end).toBeLessThanOrEqual(at("22:30").getTime());
    }
  });

  it("puts the assignment due tomorrow before the test on Friday", async () => {
    const { ctx } = await contextFor({
      tasks: TASKS,
      fixedEvents: [SCHOOL],
      blocks: [],
    });
    const { plan } = await buildPlan(ctx);

    const order = plan.blocks
      .filter((b) => b.kind === "task")
      .map((b) => b.taskId);
    expect(order.indexOf("aphug")).toBeLessThan(order.indexOf("math"));
  });

  it("persists the plan and reports how many blocks it wrote", async () => {
    const state = { tasks: TASKS, fixedEvents: [SCHOOL], blocks: [] as ScheduleBlock[] };
    const { ctx, fake } = await contextFor(state);
    const { plan } = await buildPlan(ctx);

    const count = await persistPlan(fake.client as never, ctx, plan.blocks);

    expect(count).toBe(plan.blocks.length);
    expect(fake.inserted).toHaveLength(plan.blocks.length);
    for (const row of fake.inserted) {
      expect(row.user_id).toBe("u1");
      expect(row.local_date).toBe(DATE);
      expect(row.status).toBe("planned");
    }
  });

  it("keeps finished work when replanning mid-evening", async () => {
    const completed: ScheduleBlock = {
      id: "done-1",
      user_id: "u1",
      task_id: "piano",
      title: "Piano practice",
      kind: "task",
      status: "completed",
      start_at: at("16:00").toISOString(),
      end_at: at("16:30").toISOString(),
      local_date: DATE,
      reason: null,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    };

    const laterNow = at("17:00");
    const fake = fakeSupabase({
      tasks: TASKS.filter((t) => t.id !== "piano"),
      fixedEvents: [SCHOOL],
      blocks: [completed],
    });

    const ctx = await loadPlanContext(fake.client as never, {
      userId: "u1",
      profile,
      preferences,
      timeZone: TZ,
      dateKey: DATE,
      now: laterNow,
    });

    // The completed block is preserved, and nothing new is scheduled over it.
    expect(ctx.keptBlocks.map((b) => b.id)).toContain("done-1");

    const { plan } = await buildPlan(ctx);
    for (const block of plan.blocks) {
      expect(block.start).toBeGreaterThanOrEqual(laterNow.getTime());
    }

    await persistPlan(fake.client as never, ctx, plan.blocks);
    expect(fake.deleted).not.toContain("done-1");
  });

  it("discards a model plan that breaks the rules and falls back", async () => {
    const { ctx } = await contextFor({
      tasks: TASKS,
      fixedEvents: [SCHOOL],
      blocks: [],
    });

    // A plan that invents a task and schedules during school hours.
    const badStrategy = async (): Promise<GeneratedPlan> => ({
      summary: "Made up",
      blocks: [
        {
          taskId: "not-a-real-task",
          title: "Invented",
          kind: "task",
          start: at("18:00").getTime(),
          end: at("19:00").getTime(),
          reason: "n/a",
        },
        {
          taskId: "aphug",
          title: "APHUG",
          kind: "task",
          start: at("09:00").getTime(),
          end: at("10:00").getTime(),
          reason: "during school",
        },
      ],
      deferred: [],
    });

    const { plan, source } = await buildPlan(ctx, badStrategy);

    // Every block failed validation, so DayOS uses its own scheduler instead
    // of showing an empty or invalid day.
    expect(source).toBe("builtin");
    expect(plan.blocks.length).toBeGreaterThan(0);
    expect(plan.blocks.every((b) => b.taskId !== "not-a-real-task")).toBe(true);
    expect(findOverlaps(plan.blocks)).toEqual([]);
  });

  it("keeps the valid part of a model plan and drops the rest", async () => {
    const { ctx } = await contextFor({
      tasks: TASKS,
      fixedEvents: [SCHOOL],
      blocks: [],
    });

    const mixedStrategy = async (): Promise<GeneratedPlan> => ({
      summary: "APHUG first, it's due tomorrow.",
      blocks: [
        {
          taskId: "aphug",
          title: "APHUG",
          kind: "task",
          start: at("16:30").getTime(),
          end: at("17:15").getTime(),
          reason: "Due tomorrow",
        },
        {
          taskId: "math",
          title: "Math",
          kind: "task",
          // Overlaps the block above — must be dropped.
          start: at("17:00").getTime(),
          end: at("18:00").getTime(),
          reason: "Test Friday",
        },
      ],
      deferred: [],
    });

    const { plan, source, dropped } = await buildPlan(ctx, mixedStrategy);

    expect(source).toBe("ai");
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].taskId).toBe("aphug");
    expect(dropped[0].reason).toMatch(/overlap/i);
  });

  it("falls back when the model call throws", async () => {
    const { ctx } = await contextFor({
      tasks: TASKS,
      fixedEvents: [SCHOOL],
      blocks: [],
    });

    const failing = async () => {
      throw new Error("model unavailable");
    };

    const { plan, source } = await buildPlan(ctx, failing);
    expect(source).toBe("builtin");
    expect(plan.blocks.length).toBeGreaterThan(0);
  });
});
