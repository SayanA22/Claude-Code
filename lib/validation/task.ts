import { z } from "zod";
import {
  categorySchema,
  durationSchema,
  emptyToNull,
  isoDateTimeSchema,
  prioritySchema,
  text,
  uuidSchema,
} from "./common";

export const recurrenceSchema = z.enum(["daily", "weekdays", "weekly"]);

/** Creating a task, from a form or from the assistant's `createTask` tool. */
export const createTaskSchema = z.object({
  title: text(300).min(1, "Give the task a title"),
  description: emptyToNull(text(2000)).optional().default(null),
  category: categorySchema.default("Personal"),
  priority: prioritySchema.default("medium"),
  deadline: emptyToNull(isoDateTimeSchema).optional().default(null),
  estimated_duration: durationSchema.default(30),
  recurring: emptyToNull(recurrenceSchema).optional().default(null),
  notes: emptyToNull(text(2000)).optional().default(null),
  project_id: emptyToNull(uuidSchema).optional().default(null),
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: uuidSchema,
});

export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "completed",
  "skipped",
  "archived",
]);

/**
 * A task the model extracted from natural language.
 *
 * Deliberately narrower than `createTaskSchema`: the model proposes a
 * relative deadline it observed in the text, never an absolute one it made
 * up, and the server resolves it against the user's timezone. `null` means
 * "the user didn't say", which is different from "today".
 */
export const parsedTaskSchema = z.object({
  title: z.string().min(1).max(300),
  category: z.string().max(40),
  priority: z.enum(["critical", "high", "medium", "low"]),
  estimated_duration: z.number().int().min(5).max(600),
  /**
   * Calendar day the user named, as an offset in days from today, or null.
   * `0` = today, `1` = tomorrow.
   */
  deadline_days_from_today: z.number().int().min(-30).max(365).nullable(),
  /** "HH:MM" if the user named a time of day, else null. */
  deadline_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  notes: z.string().max(500).nullable(),
});
export type ParsedTask = z.infer<typeof parsedTaskSchema>;

export const parseTaskResponseSchema = z.object({
  tasks: z.array(parsedTaskSchema).max(15),
  /** Set only when the input is genuinely unusable. */
  clarification: z.string().max(300).nullable(),
});
export type ParseTaskResponse = z.infer<typeof parseTaskResponseSchema>;
