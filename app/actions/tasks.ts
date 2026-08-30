"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import {
  createTaskSchema,
  taskStatusSchema,
  updateTaskSchema,
} from "@/lib/validation/task";
import { uuidSchema } from "@/lib/validation/common";
import { getUserContext } from "@/lib/data/profile";
import { nextOccurrence } from "@/lib/planner/recurrence";
import { wallClockIn } from "@/lib/utils/time";
import type { Task } from "@/types/db";
import { type ActionResult, handleActionError, ok } from "./result";

/**
 * Every action here derives the user from the verified session. A client can
 * name a task id, never a user id — and RLS rejects the row anyway if the id
 * belongs to someone else.
 */

function revalidateTaskViews() {
  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/plan");
  revalidatePath("/projects");
}

export async function createTask(
  input: z.input<typeof createTaskSchema>,
): Promise<ActionResult<Task>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task" };
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    revalidateTaskViews();
    return ok(data as Task);
  } catch (error) {
    return handleActionError("createTask", error, "Couldn't save that task.");
  }
}

/** Bulk create, used by natural-language capture after the user confirms. */
export async function createTasks(
  inputs: z.input<typeof createTaskSchema>[],
): Promise<ActionResult<Task[]>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = z.array(createTaskSchema).max(20).safeParse(inputs);
    if (!parsed.success) {
      return { ok: false, error: "Some of those tasks were incomplete." };
    }
    if (!parsed.data.length) return ok([] as Task[]);

    const { data, error } = await supabase
      .from("tasks")
      .insert(parsed.data.map((t) => ({ ...t, user_id: user.id })))
      .select();

    if (error) throw error;
    revalidateTaskViews();
    return ok((data ?? []) as Task[]);
  } catch (error) {
    return handleActionError("createTasks", error, "Couldn't save those tasks.");
  }
}

export async function updateTask(
  input: z.input<typeof updateTaskSchema>,
): Promise<ActionResult<Task>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task" };
    }

    const { id, ...fields } = parsed.data;
    const { data, error } = await supabase
      .from("tasks")
      .update(fields)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    revalidateTaskViews();
    return ok(data as Task);
  } catch (error) {
    return handleActionError("updateTask", error, "Couldn't update that task.");
  }
}

const setStatusSchema = z.object({
  id: uuidSchema,
  status: taskStatusSchema,
  /** Minutes actually spent, when the client knows (focus mode does). */
  actualMinutes: z.number().int().min(1).max(1440).optional(),
});

export async function setTaskStatus(
  input: z.input<typeof setStatusSchema>,
): Promise<ActionResult<Task>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = setStatusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid status change." };
    const { id, status, actualMinutes } = parsed.data;

    const patch: Partial<Task> = { status };
    if (status === "completed") {
      patch.completed_at = new Date().toISOString();
      if (actualMinutes) patch.actual_duration = actualMinutes;
    } else {
      patch.completed_at = null;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    if (status === "completed") {
      // Completing a task closes out any block still pointing at it today.
      await supabase
        .from("schedule_blocks")
        .update({ status: "completed" })
        .eq("task_id", id)
        .eq("user_id", user.id)
        .in("status", ["planned", "in_progress"]);

      await rollOverRecurring(data as Task);
    }

    revalidateTaskViews();
    return ok(data as Task);
  } catch (error) {
    return handleActionError(
      "setTaskStatus",
      error,
      "Couldn't update that task.",
    );
  }
}

const postponeSchema = z.object({
  id: uuidSchema,
  days: z.number().int().min(1).max(30).default(1),
});

/**
 * Push a task out. The postpone count feeds the priority score, so repeatedly
 * dodged work climbs rather than quietly disappearing.
 */
export async function postponeTask(
  input: z.input<typeof postponeSchema>,
): Promise<ActionResult<Task>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = postponeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };

    const { data: existing, error: readError } = await supabase
      .from("tasks")
      .select("postpone_count")
      .eq("id", parsed.data.id)
      .eq("user_id", user.id)
      .single();
    if (readError) throw readError;

    const { data, error } = await supabase
      .from("tasks")
      .update({
        postpone_count: (existing?.postpone_count ?? 0) + 1,
        status: "todo",
      })
      .eq("id", parsed.data.id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;

    // Drop the task's remaining blocks for today; replanning will re-place it.
    await supabase
      .from("schedule_blocks")
      .delete()
      .eq("task_id", parsed.data.id)
      .eq("user_id", user.id)
      .eq("status", "planned");

    revalidateTaskViews();
    return ok(data as Task);
  } catch (error) {
    return handleActionError("postponeTask", error, "Couldn't move that task.");
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!uuidSchema.safeParse(id).success) {
      return { ok: false, error: "Invalid request." };
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    revalidateTaskViews();
    return ok();
  } catch (error) {
    return handleActionError("deleteTask", error, "Couldn't delete that task.");
  }
}

/**
 * Creates the next instance of a recurring task once this one is finished.
 *
 * Exactly one open instance exists at a time — see `lib/planner/recurrence`
 * for why the series isn't materialised in advance. Failure here is logged and
 * swallowed: the completion the user asked for has already succeeded, and
 * failing it afterwards would be worse than a missed repeat.
 */
async function rollOverRecurring(task: Task): Promise<void> {
  if (!task.recurring) return;

  try {
    const ctx = await getUserContext();
    if (!ctx) return;

    const { supabase } = await requireUser();
    const from = task.deadline ? new Date(task.deadline) : new Date();
    const { hour, minute } = wallClockIn(from, ctx.timeZone);
    const time = task.deadline
      ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      : "23:59";

    const deadline = nextOccurrence(task.recurring, from, ctx.timeZone, time);
    if (!deadline) return;

    await supabase.from("tasks").insert({
      user_id: ctx.userId,
      project_id: task.project_id,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      deadline,
      estimated_duration: task.estimated_duration,
      recurring: task.recurring,
      notes: task.notes,
    });
  } catch (error) {
    console.error("[dayos:rollOverRecurring]", error);
  }
}
