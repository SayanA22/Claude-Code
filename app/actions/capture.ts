"use server";

import { z } from "zod";
import { getUserContext } from "@/lib/data/profile";
import { parseTasks, resolveDeadline } from "@/lib/ai/parse-task";
import { localDateKey } from "@/lib/utils/time";
import { calibrate } from "@/lib/planner/estimates";
import type { CreateTaskInput } from "@/lib/validation/task";
import { type ActionResult, handleActionError, ok } from "./result";

const captureSchema = z.object({
  text: z.string().trim().min(1, "Type something first").max(2000),
});

export interface CaptureDraft extends CreateTaskInput {
  /** Human-readable deadline for the confirmation screen. */
  deadlineLabel: string | null;
}

export interface CaptureResult {
  drafts: CaptureDraft[];
  clarification: string | null;
  source: "ai" | "builtin";
}

/**
 * Reads a free-text brain dump and proposes tasks.
 *
 * Nothing is saved here. The user sees exactly what was extracted, edits it if
 * it's wrong, and only then confirms — a wrong deadline saved silently is worse
 * than one more tap.
 */
export async function parseCapture(
  input: z.input<typeof captureSchema>,
): Promise<ActionResult<CaptureResult>> {
  try {
    const parsed = captureSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };

    const now = new Date();
    const todayKey = localDateKey(now, ctx.timeZone);

    const result = await parseTasks(parsed.data.text, {
      now,
      timeZone: ctx.timeZone,
      todayKey,
    });

    const drafts: CaptureDraft[] = result.tasks.map((task) => {
      const deadline = resolveDeadline(task, todayKey, ctx.timeZone);
      return {
        title: task.title,
        category: task.category,
        priority: task.priority,
        // Apply what DayOS has learned about this user's estimates.
        estimated_duration: calibrate(
          task.estimated_duration,
          ctx.preferences.estimate_multiplier,
        ),
        deadline,
        notes: task.notes,
        deadlineLabel: deadline
          ? new Intl.DateTimeFormat("en-US", {
              timeZone: ctx.timeZone,
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(deadline))
          : null,
      };
    });

    return ok({
      drafts,
      clarification: result.clarification,
      source: result.source,
    });
  } catch (error) {
    return handleActionError(
      "parseCapture",
      error,
      "I couldn't read that. Try adding the task manually.",
    );
  }
}
