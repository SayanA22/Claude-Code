import { describe, expect, it } from "vitest";
import { createTaskSchema, parseTaskResponseSchema } from "@/lib/validation/task";
import {
  assistantResponseSchema,
  isDestructive,
  planResponseSchema,
} from "@/lib/ai/schemas";
import { categorySchema, timeOfDaySchema } from "@/lib/validation/common";

describe("createTaskSchema", () => {
  it("fills sensible defaults", () => {
    const parsed = createTaskSchema.parse({ title: "Read chapter 3" });
    expect(parsed).toMatchObject({
      category: "Personal",
      priority: "medium",
      estimated_duration: 30,
      deadline: null,
    });
  });

  it("rejects an empty title", () => {
    expect(createTaskSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("rejects an implausible duration", () => {
    expect(
      createTaskSchema.safeParse({ title: "x", estimated_duration: 4 }).success,
    ).toBe(false);
    expect(
      createTaskSchema.safeParse({ title: "x", estimated_duration: 900 }).success,
    ).toBe(false);
  });

  it("treats an empty deadline field as no deadline", () => {
    expect(createTaskSchema.parse({ title: "x", deadline: "" }).deadline).toBeNull();
  });

  it("rejects an unparseable deadline rather than guessing", () => {
    expect(
      createTaskSchema.safeParse({ title: "x", deadline: "next tuesday-ish" })
        .success,
    ).toBe(false);
  });

  it("normalises deadlines to ISO", () => {
    const parsed = createTaskSchema.parse({
      title: "x",
      deadline: "2025-03-06T12:00:00Z",
    });
    expect(parsed.deadline).toBe("2025-03-06T12:00:00.000Z");
  });
});

describe("categorySchema", () => {
  it("matches a known category case-insensitively", () => {
    expect(categorySchema.parse("school")).toBe("School");
    expect(categorySchema.parse("CODING")).toBe("Coding");
  });

  it("funnels anything unknown into Other rather than failing", () => {
    // A model naming a category we don't have shouldn't lose the task.
    expect(categorySchema.parse("Underwater basket weaving")).toBe("Other");
  });
});

describe("timeOfDaySchema", () => {
  it("accepts HH:MM and HH:MM:SS", () => {
    expect(timeOfDaySchema.parse("07:30")).toBe("07:30");
    expect(timeOfDaySchema.parse("07:30:00")).toBe("07:30");
  });

  it("rejects out-of-range times", () => {
    expect(timeOfDaySchema.safeParse("25:00").success).toBe(false);
    expect(timeOfDaySchema.safeParse("7:5").success).toBe(false);
  });
});

describe("planResponseSchema", () => {
  const valid = {
    summary: "Busy school day, so APHUG goes first.",
    schedule: [
      {
        taskId: "abc",
        kind: "task",
        start: "16:45",
        end: "17:20",
        day_offset: 0,
        reason: "Due tomorrow",
      },
    ],
    deferred: [{ taskId: "def", reason: "No time left today" }],
  };

  it("accepts a well-formed plan", () => {
    expect(planResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a malformed time", () => {
    const bad = {
      ...valid,
      schedule: [{ ...valid.schedule[0], start: "4:45pm" }],
    };
    expect(planResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a day offset outside today or tomorrow", () => {
    const bad = {
      ...valid,
      schedule: [{ ...valid.schedule[0], day_offset: 3 }],
    };
    expect(planResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown block kind", () => {
    const bad = {
      ...valid,
      schedule: [{ ...valid.schedule[0], kind: "nap" }],
    };
    expect(planResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("allows a break with no task id", () => {
    const withBreak = {
      ...valid,
      schedule: [
        { taskId: null, kind: "break", start: "17:20", end: "17:30", day_offset: 0, reason: "Reset" },
      ],
    };
    expect(planResponseSchema.safeParse(withBreak).success).toBe(true);
  });
});

describe("parseTaskResponseSchema", () => {
  it("rejects a deadline offset beyond a year", () => {
    const bad = {
      tasks: [
        {
          title: "x",
          category: "School",
          priority: "medium",
          estimated_duration: 30,
          deadline_days_from_today: 5000,
          deadline_time: null,
          notes: null,
        },
      ],
      clarification: null,
    };
    expect(parseTaskResponseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("assistantResponseSchema", () => {
  it("rejects an action type the app can't execute", () => {
    const bad = {
      answer: "Done.",
      actions: [{ type: "dropDatabase", taskId: "x", title: "x" }],
    };
    expect(assistantResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts the actions the app does support", () => {
    const good = {
      answer: "Working on APHUG notes now makes the most sense.",
      actions: [
        { type: "completeTask", taskId: "abc", title: "APHUG notes" },
        { type: "planDay", instruction: null },
      ],
    };
    expect(assistantResponseSchema.safeParse(good).success).toBe(true);
  });
});

describe("isDestructive", () => {
  it("flags anything that changes or removes existing work", () => {
    expect(isDestructive({ type: "deleteTask", taskId: "a", title: "x" })).toBe(true);
    expect(isDestructive({ type: "completeTask", taskId: "a", title: "x" })).toBe(true);
    expect(
      isDestructive({ type: "rescheduleTask", taskId: "a", title: "x", days_from_today: 1 }),
    ).toBe(true);
  });

  it("lets additive actions through without a confirmation", () => {
    expect(isDestructive({ type: "planDay", instruction: null })).toBe(false);
    expect(
      isDestructive({
        type: "createTask",
        title: "x",
        category: "School",
        priority: "medium",
        estimated_duration: 30,
        deadline_days_from_today: null,
      }),
    ).toBe(false);
  });
});
