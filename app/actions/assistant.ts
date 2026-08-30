"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getUserContext, displayName } from "@/lib/data/profile";
import { listOpenTasks } from "@/lib/data/tasks";
import { listBlocksForDate, listFixedEvents } from "@/lib/data/schedule";
import { computeAvailability } from "@/lib/planner/availability";
import { localDateKey } from "@/lib/utils/time";
import { deadlineFromOffset } from "@/lib/utils/deadline";
import {
  askAssistant,
  fallbackAssistantAnswer,
  type AssistantContext,
} from "@/lib/ai/assistant";
import { isAiConfigured } from "@/lib/ai/client";
import { assistantActionSchema, type AssistantAction } from "@/lib/ai/schemas";
import type { Goal, Project } from "@/types/db";
import { createTask, setTaskStatus, updateTask } from "./tasks";
import { planDay } from "./plan";
import { type ActionResult, handleActionError, ok } from "./result";

const askSchema = z.object({
  question: z.string().trim().min(1, "Ask something").max(600),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(10)
    .optional(),
});

export interface AssistantReply {
  answer: string;
  actions: AssistantAction[];
  source: "ai" | "builtin";
}

/**
 * Answers a question using the signed-in user's own data.
 *
 * The context is assembled here, server-side — the client sends only a
 * question, never data or ids to trust.
 */
export async function ask(
  input: z.input<typeof askSchema>,
): Promise<ActionResult<AssistantReply>> {
  try {
    const parsed = askSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Ask something." };
    }

    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };
    const { supabase } = await requireUser();

    const now = new Date();
    const dateKey = localDateKey(now, ctx.timeZone);

    const [tasks, blocks, fixedEvents, projectsRes, goalsRes] =
      await Promise.all([
        listOpenTasks(ctx.userId),
        listBlocksForDate(ctx.userId, dateKey),
        listFixedEvents(ctx.userId),
        supabase
          .from("projects")
          .select("*")
          .eq("user_id", ctx.userId)
          .neq("status", "archived"),
        supabase
          .from("goals")
          .select("*")
          .eq("user_id", ctx.userId)
          .neq("status", "archived"),
      ]);

    const availability = computeAvailability({
      dateKey,
      timeZone: ctx.timeZone,
      profile: ctx.profile,
      preferences: ctx.preferences,
      fixedEvents,
      busyBlocks: blocks.filter((b) => b.status !== "skipped"),
      notBefore: now,
    });

    const assistantContext: AssistantContext = {
      now,
      timeZone: ctx.timeZone,
      dateKey,
      firstName: displayName(ctx.profile),
      tasks,
      blocks,
      projects: (projectsRes.data ?? []) as Project[],
      goals: (goalsRes.data ?? []) as Goal[],
      free: availability.free,
      focusMinutes: ctx.preferences.focus_session_minutes,
    };

    if (!isAiConfigured()) {
      const reply = fallbackAssistantAnswer(parsed.data.question, assistantContext);
      return ok({ ...reply, source: "builtin" as const });
    }

    try {
      const reply = await askAssistant(
        parsed.data.question,
        assistantContext,
        parsed.data.history ?? [],
      );

      // Discard any action naming an id the user doesn't own.
      const taskIds = new Set(tasks.map((t) => t.id));
      const projectIds = new Set(
        ((projectsRes.data ?? []) as Project[]).map((p) => p.id),
      );
      const actions = reply.actions.filter((action) => {
        if ("taskId" in action) return taskIds.has(action.taskId);
        if ("projectId" in action) return projectIds.has(action.projectId);
        return true;
      });

      return ok({ answer: reply.answer, actions, source: "ai" as const });
    } catch (error) {
      console.error("[dayos:assistant] falling back", error);
      const reply = fallbackAssistantAnswer(parsed.data.question, assistantContext);
      return ok({ ...reply, source: "builtin" as const });
    }
  } catch (error) {
    return handleActionError(
      "assistant.ask",
      error,
      "I couldn't answer that right now.",
    );
  }
}

/**
 * Executes an action the assistant proposed.
 *
 * The payload is re-validated here and every id is re-checked against the
 * user's own rows — a proposal is a suggestion, not authorisation.
 */
export async function runAssistantAction(
  action: AssistantAction,
): Promise<ActionResult<{ message: string }>> {
  try {
    const parsed = assistantActionSchema.safeParse(action);
    if (!parsed.success) return { ok: false, error: "That action isn't valid." };

    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };

    const todayKey = localDateKey(new Date(), ctx.timeZone);
    const value = parsed.data;

    switch (value.type) {
      case "createTask": {
        const result = await createTask({
          title: value.title,
          category: value.category,
          priority: value.priority,
          estimated_duration: value.estimated_duration,
          deadline: deadlineFromOffset(
            value.deadline_days_from_today,
            todayKey,
            ctx.timeZone,
          ),
        });
        if (!result.ok) return result;
        return ok({ message: `Added "${value.title}".` });
      }

      case "completeTask": {
        const result = await setTaskStatus({
          id: value.taskId,
          status: "completed",
        });
        if (!result.ok) return result;
        return ok({ message: `Marked "${value.title}" complete.` });
      }

      case "rescheduleTask": {
        const result = await updateTask({
          id: value.taskId,
          deadline: deadlineFromOffset(
            value.days_from_today,
            todayKey,
            ctx.timeZone,
          ),
        });
        if (!result.ok) return result;
        revalidatePath("/today");
        return ok({ message: `Moved "${value.title}".` });
      }

      case "deleteTask": {
        const { supabase, user } = await requireUser();
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", value.taskId)
          .eq("user_id", user.id);
        if (error) throw error;
        revalidatePath("/tasks");
        revalidatePath("/today");
        return ok({ message: `Deleted "${value.title}".` });
      }

      case "planDay": {
        const result = await planDay(
          value.instruction ? { instruction: value.instruction } : {},
        );
        if (!result.ok) return result;
        return ok({ message: result.data.summary });
      }

      case "breakDownProject": {
        // Handled by the projects screen, which shows the proposed tasks for
        // review before anything is written.
        return ok({
          message: `Open ${value.title} and choose "Break this down" to review the tasks first.`,
        });
      }
    }
  } catch (error) {
    return handleActionError(
      "assistant.runAction",
      error,
      "Couldn't do that just now.",
    );
  }
}
