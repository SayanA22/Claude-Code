import { z } from "zod";
import { CATEGORIES, TASK_PRIORITIES } from "@/types/db";

/** Shared primitives for both form input and model output. */

export const categorySchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((value) => {
    const match = CATEGORIES.find(
      (c) => c.toLowerCase() === value.toLowerCase(),
    );
    return match ?? "Other";
  });

export const prioritySchema = z.enum(
  TASK_PRIORITIES as [string, ...string[]],
) as z.ZodType<(typeof TASK_PRIORITIES)[number]>;

export const uuidSchema = z.string().uuid();

/** An ISO-8601 instant. Rejects anything Date can't parse. */
export const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Not a valid date")
  .transform((v) => new Date(v).toISOString());

/** "YYYY-MM-DD". */
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** "HH:MM" or "HH:MM:SS". */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Expected HH:MM")
  .transform((v) => v.slice(0, 5));

export const durationSchema = z
  .number()
  .int()
  .min(5, "At least 5 minutes")
  .max(600, "At most 10 hours");

/**
 * Trims and length-caps free text before it is stored or rendered.
 *
 * React escapes on render, so this is about keeping stored content sane
 * rather than about HTML safety.
 */
export function text(max: number) {
  return z.string().trim().max(max);
}

/** `""` and `"null"` both mean "unset" when they arrive from a form. */
export function emptyToNull<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => (v === "" || v === "null" || v === undefined ? null : v),
    schema.nullable(),
  );
}
