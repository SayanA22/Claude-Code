import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import {
  assignmentExtractionSchema,
  assistantResponseSchema,
  dailyReviewSchema,
  planResponseSchema,
  projectBreakdownSchema,
  weeklyReviewSchema,
} from "@/lib/ai/schemas";
import { parseTaskResponseSchema } from "@/lib/validation/task";

/**
 * Every schema DayOS asks a model to fill has to survive the trip through
 * `zodOutputFormat` into the JSON Schema the structured-output API enforces.
 *
 * Without this, an unconvertible schema surfaces as a 400 on the first real
 * model call — the one path that can't be exercised without an API key. These
 * tests check the request shape offline instead.
 *
 * They also pin down what structured output does *not* do. The converter
 * emits object shape and types as real JSON Schema, but demotes `enum`,
 * `pattern`, `maxLength` and `const` into a `description` string. Those are
 * conveyed to the model, not enforced by the API — which is exactly why
 * `askStructured` re-validates with Zod, and why the planner's repair pass
 * exists.
 */

const SCHEMAS: [string, z.ZodType][] = [
  ["planResponse", planResponseSchema],
  ["parseTaskResponse", parseTaskResponseSchema],
  ["projectBreakdown", projectBreakdownSchema],
  ["assignmentExtraction", assignmentExtractionSchema],
  ["dailyReview", dailyReviewSchema],
  ["weeklyReview", weeklyReviewSchema],
  ["assistantResponse", assistantResponseSchema],
];

function formatFor(schema: z.ZodType) {
  return zodOutputFormat(schema) as unknown as {
    type: string;
    schema: Record<string, unknown>;
  };
}

describe("model output schemas", () => {
  it.each(SCHEMAS)("%s converts to an output format", (_name, schema) => {
    const format = formatFor(schema);
    expect(format.type).toBe("json_schema");
    expect(format.schema.type).toBe("object");
    expect(format.schema.properties).toBeTruthy();
  });

  it.each(SCHEMAS)("%s serialises for the wire", (_name, schema) => {
    // A schema that can't be stringified (a cycle, an unsupported node) would
    // fail at request time, not at definition time.
    const format = formatFor(schema);
    expect(() => JSON.parse(JSON.stringify(format))).not.toThrow();
  });

  it.each(SCHEMAS)("%s requires every field it declares", (_name, schema) => {
    // Structured output fills every declared key. A schema whose `required`
    // list doesn't cover its properties would let the model omit fields the
    // app then reads as undefined.
    const format = formatFor(schema);
    const properties = Object.keys(
      (format.schema.properties ?? {}) as Record<string, unknown>,
    );
    const required = (format.schema.required ?? []) as string[];
    expect([...required].sort()).toEqual([...properties].sort());
  });

  it.each(SCHEMAS)("%s round-trips a realistic response", (name, schema) => {
    const sample = SAMPLES[name as keyof typeof SAMPLES];
    const result = schema.safeParse(sample);
    expect(result.success).toBe(true);
  });
});

describe("what the API enforces, and what it doesn't", () => {
  it("carries enums and patterns to the model as descriptions", () => {
    // Documenting the converter's behaviour: these constraints reach the model
    // as prose, not as enforced JSON Schema keywords.
    const text = JSON.stringify(formatFor(planResponseSchema));
    expect(text).toContain('enum: [\\"task\\",\\"break\\"]');
    expect(text).toContain("pattern");
    expect(text).toContain("maxLength");
  });

  it("rejects a shape-valid response that breaks those constraints", () => {
    // This is the defence that actually holds: a response the API would happily
    // return still has to survive Zod before it becomes application data.
    const wrongEnum = {
      ...SAMPLES.planResponse,
      schedule: [{ ...SAMPLES.planResponse.schedule[0], kind: "nap" }],
    };
    expect(planResponseSchema.safeParse(wrongEnum).success).toBe(false);

    const wrongTimeFormat = {
      ...SAMPLES.planResponse,
      schedule: [{ ...SAMPLES.planResponse.schedule[0], start: "4:45pm" }],
    };
    expect(planResponseSchema.safeParse(wrongTimeFormat).success).toBe(false);

    const wrongDayOffset = {
      ...SAMPLES.planResponse,
      schedule: [{ ...SAMPLES.planResponse.schedule[0], day_offset: 5 }],
    };
    expect(planResponseSchema.safeParse(wrongDayOffset).success).toBe(false);

    const overLongSummary = {
      ...SAMPLES.planResponse,
      summary: "x".repeat(500),
    };
    expect(planResponseSchema.safeParse(overLongSummary).success).toBe(false);
  });
});

const SAMPLES = {
  planResponse: {
    summary: "APHUG first — it's due tomorrow.",
    schedule: [
      {
        taskId: "a",
        kind: "task",
        start: "16:45",
        end: "17:20",
        day_offset: 0,
        reason: "Due tomorrow",
      },
      {
        taskId: null,
        kind: "break",
        start: "17:20",
        end: "17:30",
        day_offset: 0,
        reason: "Reset",
      },
    ],
    deferred: [{ taskId: "b", reason: "No time left today" }],
  },
  parseTaskResponse: {
    tasks: [
      {
        title: "APHUG notes",
        category: "School",
        priority: "high",
        estimated_duration: 45,
        deadline_days_from_today: 1,
        deadline_time: "08:30",
        notes: null,
      },
    ],
    clarification: null,
  },
  projectBreakdown: {
    summary: "Six sittings, research first.",
    tasks: [
      {
        title: "Find five sources",
        description: "Skim and note the useful ones.",
        estimated_duration: 45,
        priority: "high",
        deadline_days_from_today: null,
      },
    ],
  },
  assignmentExtraction: {
    title: "Chapter 3 Review",
    class_name: "AP Human Geography",
    due_date_days_from_today: 2,
    estimated_duration: 45,
    notes: null,
    confidence: "high",
    unreadable_reason: null,
  },
  dailyReview: {
    summary: "Three tasks done, one slipped.",
    estimate_note: null,
  },
  weeklyReview: {
    summary: "82% of planned sessions completed.",
    focus_next_week: "Science Research Project",
  },
  assistantResponse: {
    answer: "Start APHUG notes now — it's due tomorrow.",
    actions: [{ type: "planDay", instruction: null }],
  },
} as const;
