import { z } from "zod";

/**
 * Schemas for everything a model is allowed to return.
 *
 * These are deliberately plain — no defaults, transforms or refinements — so
 * they translate cleanly into the JSON schema the structured-output API
 * enforces. Semantic checks (does this task exist? does this block fit in a
 * free window?) happen afterwards, against the database.
 *
 * Times are wall-clock in the user's timezone, with a day offset for the rare
 * block that lands after midnight. The server converts to UTC — the model is
 * never asked to do timezone arithmetic.
 */

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");

export const plannedBlockSchema = z.object({
  /** A task id from the provided list, or null for a break. */
  taskId: z.string().nullable(),
  kind: z.enum(["task", "break"]),
  start: timeOfDay,
  end: timeOfDay,
  /** 0 for today, 1 for after midnight. */
  day_offset: z.union([z.literal(0), z.literal(1)]),
  /** A short phrase, e.g. "Due tomorrow". */
  reason: z.string().max(120),
});
export type PlannedBlockOutput = z.infer<typeof plannedBlockSchema>;

export const planResponseSchema = z.object({
  summary: z.string().min(1).max(400),
  schedule: z.array(plannedBlockSchema).max(40),
  deferred: z
    .array(
      z.object({
        taskId: z.string(),
        reason: z.string().max(160),
      }),
    )
    .max(30),
});
export type PlanResponse = z.infer<typeof planResponseSchema>;

export const projectBreakdownSchema = z.object({
  summary: z.string().max(400),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(400).nullable(),
        estimated_duration: z.number().int().min(10).max(240),
        priority: z.enum(["critical", "high", "medium", "low"]),
        /** Days from today, or null to leave it undated. */
        deadline_days_from_today: z.number().int().min(0).max(365).nullable(),
      }),
    )
    .min(1)
    .max(12),
});
export type ProjectBreakdown = z.infer<typeof projectBreakdownSchema>;

export const assignmentExtractionSchema = z.object({
  title: z.string().max(200),
  class_name: z.string().max(120).nullable(),
  due_date_days_from_today: z.number().int().min(-30).max(365).nullable(),
  estimated_duration: z.number().int().min(5).max(600).nullable(),
  notes: z.string().max(600).nullable(),
  confidence: z.enum(["high", "low"]),
  /** Set only when the image could not be read. */
  unreadable_reason: z.string().max(200).nullable(),
});
export type AssignmentExtraction = z.infer<typeof assignmentExtractionSchema>;

export const dailyReviewSchema = z.object({
  summary: z.string().min(1).max(600),
  /** Only when the planned-vs-actual numbers show a consistent gap. */
  estimate_note: z.string().max(240).nullable(),
});
export type DailyReviewOutput = z.infer<typeof dailyReviewSchema>;

export const weeklyReviewSchema = z.object({
  summary: z.string().min(1).max(900),
  focus_next_week: z.string().max(240).nullable(),
});
export type WeeklyReviewOutput = z.infer<typeof weeklyReviewSchema>;

/**
 * Actions the assistant may propose. Nothing here is executed on the model's
 * say-so: the app validates ids against the user's own rows, and anything
 * destructive is confirmed by the user first.
 */
export const assistantActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("createTask"),
    title: z.string().min(1).max(300),
    category: z.string().max(40),
    priority: z.enum(["critical", "high", "medium", "low"]),
    estimated_duration: z.number().int().min(5).max(600),
    deadline_days_from_today: z.number().int().min(0).max(365).nullable(),
  }),
  z.object({
    type: z.literal("completeTask"),
    taskId: z.string(),
    title: z.string().max(300),
  }),
  z.object({
    type: z.literal("rescheduleTask"),
    taskId: z.string(),
    title: z.string().max(300),
    days_from_today: z.number().int().min(0).max(365),
  }),
  z.object({
    type: z.literal("deleteTask"),
    taskId: z.string(),
    title: z.string().max(300),
  }),
  z.object({
    type: z.literal("planDay"),
    instruction: z.string().max(300).nullable(),
  }),
  z.object({
    type: z.literal("breakDownProject"),
    projectId: z.string(),
    title: z.string().max(200),
  }),
]);
export type AssistantAction = z.infer<typeof assistantActionSchema>;

export const assistantResponseSchema = z.object({
  answer: z.string().min(1).max(1200),
  actions: z.array(assistantActionSchema).max(5),
});
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
