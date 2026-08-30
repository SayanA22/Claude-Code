"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/data/profile";
import { breakDownProject } from "@/lib/ai/break-down-project";
import { isAiConfigured } from "@/lib/ai/client";
import {
  dateKeySchema,
  emptyToNull,
  text,
  uuidSchema,
} from "@/lib/validation/common";
import { localDateKey } from "@/lib/utils/time";
import { deadlineFromOffset } from "@/lib/utils/deadline";
import type { Goal, Task } from "@/types/db";
import { createTasks } from "./tasks";
import { type ActionResult, handleActionError, ok } from "./result";

const goalSchema = z.object({
  title: text(160).min(1, "Give the goal a name"),
  description: emptyToNull(text(1000)).optional().default(null),
  deadline: emptyToNull(dateKeySchema).optional().default(null),
});

function revalidateGoalViews() {
  revalidatePath("/goals");
  revalidatePath("/today");
}

export async function createGoal(
  input: z.input<typeof goalSchema>,
): Promise<ActionResult<Goal>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = goalSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid goal" };
    }

    const { data, error } = await supabase
      .from("goals")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    revalidateGoalViews();
    return ok(data as Goal);
  } catch (error) {
    return handleActionError("createGoal", error, "Couldn't save that goal.");
  }
}

export async function updateGoal(
  input: z.input<typeof goalSchema> & { id: string; status?: string },
): Promise<ActionResult<Goal>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = goalSchema
      .partial()
      .extend({
        id: uuidSchema,
        status: z.enum(["active", "completed", "archived"]).optional(),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid goal." };

    const { id, ...fields } = parsed.data;
    const { data, error } = await supabase
      .from("goals")
      .update(fields)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;

    revalidateGoalViews();
    return ok(data as Goal);
  } catch (error) {
    return handleActionError("updateGoal", error, "Couldn't update that goal.");
  }
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!uuidSchema.safeParse(id).success) {
      return { ok: false, error: "Invalid request." };
    }
    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidateGoalViews();
    return ok();
  } catch (error) {
    return handleActionError("deleteGoal", error, "Couldn't delete that goal.");
  }
}

const milestoneSchema = z.object({
  goalId: uuidSchema,
  title: text(200).min(1),
  dueDate: emptyToNull(dateKeySchema).optional().default(null),
});

export async function addMilestone(
  input: z.input<typeof milestoneSchema>,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = milestoneSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid milestone." };

    const { count } = await supabase
      .from("goal_milestones")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", parsed.data.goalId)
      .eq("user_id", user.id);

    const { error } = await supabase.from("goal_milestones").insert({
      goal_id: parsed.data.goalId,
      user_id: user.id,
      title: parsed.data.title,
      due_date: parsed.data.dueDate,
      position: count ?? 0,
    });
    if (error) throw error;

    revalidateGoalViews();
    return ok();
  } catch (error) {
    return handleActionError("addMilestone", error, "Couldn't add that milestone.");
  }
}

export async function setMilestoneComplete(
  id: string,
  completed: boolean,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!uuidSchema.safeParse(id).success) {
      return { ok: false, error: "Invalid request." };
    }
    const { error } = await supabase
      .from("goal_milestones")
      .update({ completed })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidateGoalViews();
    return ok();
  } catch (error) {
    return handleActionError(
      "setMilestoneComplete",
      error,
      "Couldn't update that milestone.",
    );
  }
}

export interface GoalTaskProposal {
  summary: string;
  tasks: {
    title: string;
    description: string | null;
    estimated_duration: number;
    priority: "critical" | "high" | "medium" | "low";
    deadline: string | null;
  }[];
  source: "ai" | "builtin";
}

/**
 * Turns a goal into concrete tasks. Proposes only — the goals screen shows the
 * list for review before anything is written.
 */
export async function proposeGoalTasks(
  goalId: string,
): Promise<ActionResult<GoalTaskProposal>> {
  try {
    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };
    if (!uuidSchema.safeParse(goalId).success) {
      return { ok: false, error: "Invalid request." };
    }

    const { supabase } = await requireUser();
    const [{ data: goal }, { data: linked }] = await Promise.all([
      supabase
        .from("goals")
        .select("*")
        .eq("id", goalId)
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("goal_tasks")
        .select("task:tasks(*)")
        .eq("goal_id", goalId)
        .eq("user_id", ctx.userId),
    ]);

    if (!goal) return { ok: false, error: "That goal no longer exists." };

    const existing = ((linked ?? []) as unknown as { task: Task | null }[])
      .map((row) => row.task)
      .filter((t): t is Task => Boolean(t));

    const todayKey = localDateKey(new Date(), ctx.timeZone);
    const breakdown = await breakDownProject(
      {
        title: (goal as Goal).title,
        description: (goal as Goal).description,
        category: "Personal",
        deadline: (goal as Goal).deadline,
      },
      existing,
      { todayKey, focusMinutes: ctx.preferences.focus_session_minutes },
    );

    return ok({
      summary: breakdown.summary,
      source: isAiConfigured() ? ("ai" as const) : ("builtin" as const),
      tasks: breakdown.tasks.map((t) => ({
        title: t.title,
        description: t.description,
        estimated_duration: t.estimated_duration,
        priority: t.priority,
        deadline: deadlineFromOffset(
          t.deadline_days_from_today,
          todayKey,
          ctx.timeZone,
        ),
      })),
    });
  } catch (error) {
    return handleActionError(
      "proposeGoalTasks",
      error,
      "I couldn't turn that goal into tasks right now.",
    );
  }
}

const saveGoalTasksSchema = z.object({
  goalId: uuidSchema,
  tasks: z
    .array(
      z.object({
        title: text(300).min(1),
        description: emptyToNull(text(2000)).optional().default(null),
        estimated_duration: z.number().int().min(5).max(600),
        priority: z.enum(["critical", "high", "medium", "low"]),
        deadline: z.string().nullable(),
      }),
    )
    .min(1)
    .max(20),
});

/** Creates tasks for a goal and links them through `goal_tasks`. */
export async function saveGoalTasks(
  input: z.input<typeof saveGoalTasksSchema>,
): Promise<ActionResult<{ created: number }>> {
  try {
    const parsed = saveGoalTasksSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Those tasks weren't valid." };

    const { supabase, user } = await requireUser();
    const { data: goal } = await supabase
      .from("goals")
      .select("id")
      .eq("id", parsed.data.goalId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!goal) return { ok: false, error: "That goal no longer exists." };

    const result = await createTasks(
      parsed.data.tasks.map((t) => ({ ...t, category: "Personal" })),
    );
    if (!result.ok) return result;

    const { error } = await supabase.from("goal_tasks").insert(
      result.data.map((task) => ({
        goal_id: parsed.data.goalId,
        task_id: task.id,
        user_id: user.id,
      })),
    );
    if (error) throw error;

    revalidateGoalViews();
    return ok({ created: result.data.length });
  } catch (error) {
    return handleActionError("saveGoalTasks", error, "Couldn't save those tasks.");
  }
}
