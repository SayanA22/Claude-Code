"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/data/profile";
import {
  DEMO_FIXED_EVENTS,
  DEMO_GOALS,
  DEMO_PROJECTS,
  DEMO_TASKS,
} from "@/lib/demo/data";
import {
  addDaysToKey,
  fromLocalParts,
  localDateKey,
  safeTimeZone,
} from "@/lib/utils/time";
import { text, timeOfDaySchema } from "@/lib/validation/common";
import { type ActionResult, handleActionError, ok } from "./result";

const profileSchema = z.object({
  fullName: text(80).min(1, "Name can't be empty"),
  timezone: text(64),
  wakeTime: timeOfDaySchema,
  bedTime: timeOfDaySchema,
});

export async function updateProfile(
  input: z.input<typeof profileSchema>,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        timezone: safeTimeZone(parsed.data.timezone),
        wake_time: parsed.data.wakeTime,
        bed_time: parsed.data.bedTime,
      })
      .eq("id", user.id);
    if (error) throw error;

    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return handleActionError("updateProfile", error, "Couldn't save your details.");
  }
}

const preferencesSchema = z.object({
  focusMinutes: z.number().int().min(10).max(180),
  breakMinutes: z.number().int().min(0).max(60),
  energyPeak: z.enum(["morning", "afternoon", "evening"]),
  notifications: z.object({
    enabled: z.boolean(),
    sessionStart: z.boolean(),
    dailyPlanReminder: z.boolean(),
    deadlineWarnings: z.boolean(),
    quietHours: z.object({
      start: timeOfDaySchema,
      end: timeOfDaySchema,
    }),
  }),
});

export async function updatePreferences(
  input: z.input<typeof preferencesSchema>,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Those settings weren't valid." };
    }

    const { error } = await supabase
      .from("user_preferences")
      .update({
        focus_session_minutes: parsed.data.focusMinutes,
        break_minutes: parsed.data.breakMinutes,
        energy_peak: parsed.data.energyPeak,
        notifications: parsed.data.notifications,
      })
      .eq("user_id", user.id);
    if (error) throw error;

    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return handleActionError(
      "updatePreferences",
      error,
      "Couldn't save your preferences.",
    );
  }
}

/**
 * Fills the signed-in account with a believable week of student data.
 *
 * Only reachable when NEXT_PUBLIC_ENABLE_DEMO_MODE is on, and only ever run by
 * an explicit click — no code path outside this function touches demo data.
 */
export async function seedDemoData(): Promise<ActionResult<{ tasks: number }>> {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE !== "true") {
      return { ok: false, error: "Demo mode is turned off." };
    }

    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };
    const { supabase } = await requireUser();

    const todayKey = localDateKey(new Date(), ctx.timeZone);
    const dueAt = (days: number | null, time = "23:59") =>
      days == null
        ? null
        : fromLocalParts(addDaysToKey(todayKey, days), time, ctx.timeZone).toISOString();

    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .insert(
        DEMO_PROJECTS.map((p) => ({
          user_id: ctx.userId,
          title: p.title,
          description: p.description,
          category: p.category,
          deadline: addDaysToKey(todayKey, p.dueInDays),
        })),
      )
      .select("id, title");
    if (projectError) throw projectError;

    const projectIdByKey = new Map<string, string>();
    DEMO_PROJECTS.forEach((p, index) => {
      const created = projects?.[index];
      if (created) projectIdByKey.set(p.key, created.id as string);
    });

    const { data: tasks, error: taskError } = await supabase
      .from("tasks")
      .insert(
        DEMO_TASKS.map((t) => ({
          user_id: ctx.userId,
          title: t.title,
          description: t.description ?? null,
          category: t.category,
          priority: t.priority,
          estimated_duration: t.estimated_duration,
          deadline: dueAt(t.dueInDays, t.dueTime),
          postpone_count: t.postpone_count ?? 0,
          project_id: t.project ? (projectIdByKey.get(t.project) ?? null) : null,
        })),
      )
      .select("id");
    if (taskError) throw taskError;

    const { data: goals, error: goalError } = await supabase
      .from("goals")
      .insert(
        DEMO_GOALS.map((g) => ({
          user_id: ctx.userId,
          title: g.title,
          description: g.description,
          deadline: g.dueInDays == null ? null : addDaysToKey(todayKey, g.dueInDays),
        })),
      )
      .select("id");
    if (goalError) throw goalError;

    const milestones = DEMO_GOALS.flatMap((goal, index) =>
      goal.milestones.map((title, position) => ({
        goal_id: goals?.[index]?.id as string,
        user_id: ctx.userId,
        title,
        position,
      })),
    ).filter((m) => m.goal_id);
    if (milestones.length) {
      const { error } = await supabase.from("goal_milestones").insert(milestones);
      if (error) throw error;
    }

    // Only add the demo commitments if the account has none — otherwise a real
    // schedule would end up double-booked.
    const { count } = await supabase
      .from("fixed_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId);

    if ((count ?? 0) === 0) {
      const { error } = await supabase.from("fixed_events").insert(
        DEMO_FIXED_EVENTS.map((e) => ({
          user_id: ctx.userId,
          title: e.title,
          category: e.category,
          recurring_days: e.days,
          start_time: e.start,
          end_time: e.end,
        })),
      );
      if (error) throw error;
    }

    revalidatePath("/", "layout");
    return ok({ tasks: tasks?.length ?? 0 });
  } catch (error) {
    return handleActionError("seedDemoData", error, "Couldn't load the demo data.");
  }
}
