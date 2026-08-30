"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { overlaps } from "@/lib/planner/intervals";
import type { ScheduleBlock } from "@/types/db";
import { type ActionResult, handleActionError, ok } from "./result";

function revalidateScheduleViews() {
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/tasks");
}

/** Marks a block (and its task) as running. */
export async function startBlock(blockId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!uuidSchema.safeParse(blockId).success) {
      return { ok: false, error: "Invalid request." };
    }

    const { data: block, error } = await supabase
      .from("schedule_blocks")
      .update({ status: "in_progress" })
      .eq("id", blockId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;

    if (block?.task_id) {
      await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", block.task_id)
        .eq("user_id", user.id)
        .eq("status", "todo");
    }

    revalidateScheduleViews();
    return ok();
  } catch (error) {
    return handleActionError("startBlock", error, "Couldn't start that session.");
  }
}

const completeBlockSchema = z.object({
  blockId: uuidSchema,
  /** Minutes actually spent in the session, from the focus timer. */
  actualMinutes: z.number().int().min(1).max(1440).optional(),
});

/**
 * Finishes a session.
 *
 * The task is only marked done when this was its last remaining block — a task
 * split across two sessions shouldn't complete halfway through.
 */
export async function completeBlock(
  input: z.input<typeof completeBlockSchema>,
): Promise<ActionResult<{ taskCompleted: boolean }>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = completeBlockSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };

    const { data: block, error } = await supabase
      .from("schedule_blocks")
      .update({ status: "completed" })
      .eq("id", parsed.data.blockId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;

    let taskCompleted = false;

    if (block?.task_id) {
      const { count } = await supabase
        .from("schedule_blocks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("task_id", block.task_id)
        .in("status", ["planned", "in_progress"]);

      const { data: task } = await supabase
        .from("tasks")
        .select("actual_duration")
        .eq("id", block.task_id)
        .eq("user_id", user.id)
        .maybeSingle();

      const spent =
        (task?.actual_duration ?? 0) +
        (parsed.data.actualMinutes ?? minutesBetween(block));

      if ((count ?? 0) === 0) {
        taskCompleted = true;
        await supabase
          .from("tasks")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            actual_duration: spent,
          })
          .eq("id", block.task_id)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("tasks")
          .update({ status: "in_progress", actual_duration: spent })
          .eq("id", block.task_id)
          .eq("user_id", user.id);
      }
    }

    revalidateScheduleViews();
    return ok({ taskCompleted });
  } catch (error) {
    return handleActionError(
      "completeBlock",
      error,
      "Couldn't close out that session.",
    );
  }
}

export async function skipBlock(blockId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!uuidSchema.safeParse(blockId).success) {
      return { ok: false, error: "Invalid request." };
    }

    const { data: block, error } = await supabase
      .from("schedule_blocks")
      .update({ status: "skipped" })
      .eq("id", blockId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;

    if (block?.task_id) {
      const { data: task } = await supabase
        .from("tasks")
        .select("postpone_count")
        .eq("id", block.task_id)
        .eq("user_id", user.id)
        .maybeSingle();

      await supabase
        .from("tasks")
        .update({
          status: "todo",
          postpone_count: (task?.postpone_count ?? 0) + 1,
        })
        .eq("id", block.task_id)
        .eq("user_id", user.id);
    }

    revalidateScheduleViews();
    return ok();
  } catch (error) {
    return handleActionError("skipBlock", error, "Couldn't skip that session.");
  }
}

const moveBlockSchema = z.object({
  blockId: uuidSchema,
  start: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  /** Optional new length; defaults to keeping the current one. */
  durationMinutes: z.number().int().min(5).max(600).optional(),
});

/**
 * Moves a block to a new start time.
 *
 * Refuses the move if it would collide with another block that day — the
 * "never schedule two things at once" rule holds for manual edits too.
 */
export async function moveBlock(
  input: z.input<typeof moveBlockSchema>,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = moveBlockSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };

    const { data: block, error: readError } = await supabase
      .from("schedule_blocks")
      .select("*")
      .eq("id", parsed.data.blockId)
      .eq("user_id", user.id)
      .single();
    if (readError) throw readError;

    const existing = block as ScheduleBlock;
    const lengthMs = parsed.data.durationMinutes
      ? parsed.data.durationMinutes * 60_000
      : new Date(existing.end_at).getTime() -
        new Date(existing.start_at).getTime();

    const start = new Date(parsed.data.start).getTime();
    const end = start + lengthMs;

    const { data: sameDay } = await supabase
      .from("schedule_blocks")
      .select("id, start_at, end_at")
      .eq("user_id", user.id)
      .eq("local_date", existing.local_date)
      .neq("id", existing.id);

    const clash = (sameDay ?? []).some((b) =>
      overlaps(
        { start, end },
        {
          start: new Date(b.start_at).getTime(),
          end: new Date(b.end_at).getTime(),
        },
      ),
    );
    if (clash) {
      return { ok: false, error: "That time already has something scheduled." };
    }

    const { error } = await supabase
      .from("schedule_blocks")
      .update({
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        status: "planned",
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidateScheduleViews();
    return ok();
  } catch (error) {
    return handleActionError("moveBlock", error, "Couldn't move that session.");
  }
}

export async function deleteBlock(blockId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!uuidSchema.safeParse(blockId).success) {
      return { ok: false, error: "Invalid request." };
    }
    const { error } = await supabase
      .from("schedule_blocks")
      .delete()
      .eq("id", blockId)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidateScheduleViews();
    return ok();
  } catch (error) {
    return handleActionError("deleteBlock", error, "Couldn't remove that block.");
  }
}

function minutesBetween(block: { start_at: string; end_at: string }): number {
  return Math.max(
    1,
    Math.round(
      (new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) /
        60_000,
    ),
  );
}
