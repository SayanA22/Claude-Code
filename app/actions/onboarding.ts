"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/utils/time";
import { text, timeOfDaySchema } from "@/lib/validation/common";
import { type ActionResult, handleActionError, ok } from "./result";

const windowSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).max(7),
  start: timeOfDaySchema,
  end: timeOfDaySchema,
});

const onboardingSchema = z.object({
  fullName: text(80).min(1, "What should DayOS call you?"),
  timezone: text(64),
  wakeTime: timeOfDaySchema,
  bedTime: timeOfDaySchema,
  areas: z.array(text(40)).max(12),
  schoolLabel: text(120).optional(),
  /** Weekly class/work block, turned into a fixed commitment. */
  schedule: windowSchema.nullable().optional(),
  goals: z.array(text(160)).max(8),
  focusMinutes: z.number().int().min(10).max(180),
  breakMinutes: z.number().int().min(0).max(60),
  energyPeak: z.enum(["morning", "afternoon", "evening"]),
  freeWindows: z.array(windowSchema).max(7),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;

/**
 * Persists everything the onboarding flow collected, in one pass.
 *
 * The weekly school/work block becomes a `fixed_event` so the planner treats
 * it as time that genuinely isn't available — that's the difference between a
 * schedule that fits a student's day and one that ignores it.
 */
export async function completeOnboarding(
  input: OnboardingInput,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = onboardingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Something was missing.",
      };
    }
    const data = parsed.data;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        timezone: safeTimeZone(data.timezone),
        wake_time: data.wakeTime,
        bed_time: data.bedTime,
        school_label: data.schoolLabel || null,
        areas: data.areas,
        onboarded: true,
      })
      .eq("id", user.id);
    if (profileError) throw profileError;

    const { error: prefsError } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          focus_session_minutes: data.focusMinutes,
          break_minutes: data.breakMinutes,
          energy_peak: data.energyPeak,
          free_windows: data.freeWindows,
        },
        { onConflict: "user_id" },
      );
    if (prefsError) throw prefsError;

    if (data.schedule && data.schedule.days.length) {
      const { error } = await supabase.from("fixed_events").insert({
        user_id: user.id,
        title: data.schoolLabel || "School",
        category: "School",
        recurring_days: data.schedule.days,
        start_time: data.schedule.start,
        end_time: data.schedule.end,
      });
      if (error) throw error;
    }

    const goals = data.goals.map((g) => g.trim()).filter(Boolean);
    if (goals.length) {
      const { error } = await supabase.from("goals").insert(
        goals.map((title) => ({ user_id: user.id, title })),
      );
      if (error) throw error;
    }

    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return handleActionError(
      "completeOnboarding",
      error,
      "Couldn't save your setup. Try again.",
    );
  }
}
