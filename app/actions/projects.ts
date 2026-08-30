"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/data/profile";
import { listTasksForProject } from "@/lib/data/tasks";
import { breakDownProject } from "@/lib/ai/break-down-project";
import { isAiConfigured } from "@/lib/ai/client";
import {
  categorySchema,
  dateKeySchema,
  emptyToNull,
  text,
  uuidSchema,
} from "@/lib/validation/common";
import { localDateKey } from "@/lib/utils/time";
import { deadlineFromOffset } from "@/lib/utils/deadline";
import type { Project, Task } from "@/types/db";
import { createTasks } from "./tasks";
import { type ActionResult, handleActionError, ok } from "./result";

const projectSchema = z.object({
  title: text(200).min(1, "Give the project a name"),
  description: emptyToNull(text(2000)).optional().default(null),
  category: categorySchema.default("Projects"),
  deadline: emptyToNull(dateKeySchema).optional().default(null),
  goal_id: emptyToNull(uuidSchema).optional().default(null),
});

function revalidateProjectViews(projectId?: string) {
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/today");
}

export async function createProject(
  input: z.input<typeof projectSchema>,
): Promise<ActionResult<Project>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid project" };
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    revalidateProjectViews();
    return ok(data as Project);
  } catch (error) {
    return handleActionError("createProject", error, "Couldn't save that project.");
  }
}

export async function updateProject(
  input: z.input<typeof projectSchema> & { id: string },
): Promise<ActionResult<Project>> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = projectSchema.partial().extend({ id: uuidSchema }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid project." };

    const { id, ...fields } = parsed.data;
    const { data, error } = await supabase
      .from("projects")
      .update(fields)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;

    revalidateProjectViews(id);
    return ok(data as Project);
  } catch (error) {
    return handleActionError("updateProject", error, "Couldn't update that project.");
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!uuidSchema.safeParse(id).success) {
      return { ok: false, error: "Invalid request." };
    }
    // Tasks survive: the FK is ON DELETE SET NULL, so work isn't lost with the
    // container it happened to sit in.
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidateProjectViews();
    return ok();
  } catch (error) {
    return handleActionError("deleteProject", error, "Couldn't delete that project.");
  }
}

export interface BreakdownProposal {
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
 * Proposes a task breakdown for a project. Writes nothing — the caller shows
 * the list for review and calls `saveBreakdown` with what the user kept.
 */
export async function proposeBreakdown(
  projectId: string,
): Promise<ActionResult<BreakdownProposal>> {
  try {
    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };
    if (!uuidSchema.safeParse(projectId).success) {
      return { ok: false, error: "Invalid request." };
    }

    const { supabase } = await requireUser();
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (!project) return { ok: false, error: "That project no longer exists." };

    const existing: Task[] = await listTasksForProject(ctx.userId, projectId);
    const todayKey = localDateKey(new Date(), ctx.timeZone);

    const breakdown = await breakDownProject(project as Project, existing, {
      todayKey,
      focusMinutes: ctx.preferences.focus_session_minutes,
    });

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
      "proposeBreakdown",
      error,
      "I couldn't break that project down right now.",
    );
  }
}

const saveBreakdownSchema = z.object({
  projectId: uuidSchema,
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

/** Writes the tasks the user kept from a proposed breakdown. */
export async function saveBreakdown(
  input: z.input<typeof saveBreakdownSchema>,
): Promise<ActionResult<{ created: number }>> {
  try {
    const parsed = saveBreakdownSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Those tasks weren't valid." };

    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };

    const { supabase } = await requireUser();
    const { data: project } = await supabase
      .from("projects")
      .select("id, category")
      .eq("id", parsed.data.projectId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (!project) return { ok: false, error: "That project no longer exists." };

    const result = await createTasks(
      parsed.data.tasks.map((t) => ({
        ...t,
        category: project.category,
        project_id: parsed.data.projectId,
      })),
    );
    if (!result.ok) return result;

    revalidateProjectViews(parsed.data.projectId);
    return ok({ created: result.data.length });
  } catch (error) {
    return handleActionError("saveBreakdown", error, "Couldn't save those tasks.");
  }
}
