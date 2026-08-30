"use server";

import { z } from "zod";
import { getUserContext } from "@/lib/data/profile";
import {
  extractAssignment,
  ImageUnsupportedError,
  MAX_IMAGE_BYTES,
} from "@/lib/ai/assignment";
import { isAiConfigured } from "@/lib/ai/client";
import { calibrate } from "@/lib/planner/estimates";
import { localDateKey, wallClockIn } from "@/lib/utils/time";
import { deadlineFromOffset } from "@/lib/utils/deadline";
import { type ActionResult, handleActionError, ok } from "./result";

const schema = z.object({
  // Rejected early on size so an oversized upload never reaches the model.
  imageDataUrl: z
    .string()
    .max(Math.ceil(MAX_IMAGE_BYTES * 1.4), "That image is too large."),
});

export interface AssignmentDraft {
  title: string;
  className: string | null;
  deadline: string | null;
  deadlineLabel: string | null;
  estimatedDuration: number;
  notes: string | null;
  confidence: "high" | "low";
}

/**
 * Reads an assignment out of a photo and returns it for confirmation.
 * Nothing is written to the database here.
 */
export async function readAssignmentImage(
  input: z.input<typeof schema>,
): Promise<ActionResult<AssignmentDraft>> {
  try {
    if (!isAiConfigured()) {
      return {
        ok: false,
        error: "Photo reading needs an API key. Enter the details instead.",
      };
    }

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid image." };
    }

    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };

    const now = new Date();
    const todayKey = localDateKey(now, ctx.timeZone);
    const weekday = wallClockIn(now, ctx.timeZone).weekday;

    const extraction = await extractAssignment(parsed.data.imageDataUrl, {
      todayKey,
      weekdayName: DAY_NAMES[weekday],
    });

    if (extraction.unreadable_reason || !extraction.title.trim()) {
      return {
        ok: false,
        error:
          extraction.unreadable_reason ??
          "I couldn't read an assignment in that photo.",
      };
    }

    const deadline = deadlineFromOffset(
      extraction.due_date_days_from_today,
      todayKey,
      ctx.timeZone,
    );

    return ok({
      title: extraction.title.trim(),
      className: extraction.class_name,
      deadline,
      deadlineLabel: deadline
        ? new Intl.DateTimeFormat("en-US", {
            timeZone: ctx.timeZone,
            weekday: "short",
            month: "short",
            day: "numeric",
          }).format(new Date(deadline))
        : null,
      estimatedDuration: calibrate(
        extraction.estimated_duration ?? 45,
        ctx.preferences.estimate_multiplier,
      ),
      notes: extraction.notes,
      confidence: extraction.confidence,
    });
  } catch (error) {
    if (error instanceof ImageUnsupportedError) {
      return { ok: false, error: error.message };
    }
    return handleActionError(
      "readAssignmentImage",
      error,
      "I couldn't read that photo. Enter the details instead.",
    );
  }
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
