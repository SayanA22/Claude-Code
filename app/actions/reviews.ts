"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/data/profile";
import { listBlocksForDate, listBlocksInRange } from "@/lib/data/schedule";
import { listOpenTasks, listRecentlyCompleted } from "@/lib/data/tasks";
import { listProjects } from "@/lib/data/projects";
import { computeDailyStats, computeWeeklyStats } from "@/lib/data/reviews";
import { summariseDay, summariseWeek } from "@/lib/ai/reviews";
import { nextMultiplier, samplesFromTasks } from "@/lib/planner/estimates";
import {
  addDaysToKey,
  fromLocalParts,
  localDateKey,
  startOfWeekKey,
} from "@/lib/utils/time";
import type { WeeklyReviewStats } from "@/types/db";
import { text } from "@/lib/validation/common";
import { type ActionResult, handleActionError, ok } from "./result";

const dailySchema = z.object({
  reflection: text(1000).optional(),
});

export interface DailyReviewResult {
  summary: string;
  estimateNote: string | null;
  completedCount: number;
  postponedCount: number;
  plannedMinutes: number;
  actualMinutes: number;
}

/**
 * Closes out the day: counts what happened, writes a short summary, and
 * updates the user's estimate calibration.
 *
 * The calibration only ever models how long work takes. Nothing else about the
 * user is inferred or stored.
 */
export async function generateDailyReview(
  input: z.input<typeof dailySchema> = {},
): Promise<ActionResult<DailyReviewResult>> {
  try {
    const parsed = dailySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };

    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };
    const { supabase } = await requireUser();

    const now = new Date();
    const dateKey = localDateKey(now, ctx.timeZone);
    const dayStart = fromLocalParts(dateKey, "00:00", ctx.timeZone);

    const [blocks, completedToday] = await Promise.all([
      listBlocksForDate(ctx.userId, dateKey),
      listRecentlyCompleted(ctx.userId, dayStart),
    ]);

    const stats = computeDailyStats(dateKey, blocks, completedToday);
    const reflection = parsed.data.reflection?.trim() || null;
    const review = await summariseDay(stats, reflection);

    const { error } = await supabase.from("daily_reviews").upsert(
      {
        user_id: ctx.userId,
        local_date: dateKey,
        completed_count: stats.completedCount,
        postponed_count: stats.postponedCount,
        planned_minutes: stats.plannedMinutes,
        actual_minutes: stats.actualMinutes,
        reflection,
        ai_summary: review.summary,
      },
      { onConflict: "user_id,local_date" },
    );
    if (error) throw error;

    await recalibrateEstimates(ctx.userId, ctx.preferences.estimate_multiplier);

    revalidatePath("/review");
    revalidatePath("/today");

    return ok({
      summary: review.summary,
      estimateNote: review.estimate_note,
      completedCount: stats.completedCount,
      postponedCount: stats.postponedCount,
      plannedMinutes: stats.plannedMinutes,
      actualMinutes: stats.actualMinutes,
    });
  } catch (error) {
    return handleActionError(
      "generateDailyReview",
      error,
      "I couldn't write today's review. Your data is safe.",
    );
  }
}

export interface WeeklyReviewResult {
  summary: string;
  focusNextWeek: string | null;
  stats: WeeklyReviewStats;
}

export async function generateWeeklyReview(): Promise<
  ActionResult<WeeklyReviewResult>
> {
  try {
    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };
    const { supabase } = await requireUser();

    const now = new Date();
    const todayKey = localDateKey(now, ctx.timeZone);
    const weekStart = startOfWeekKey(todayKey);
    const weekEnd = addDaysToKey(weekStart, 6);

    const [blocks, completed, openTasks, projects] = await Promise.all([
      listBlocksInRange(ctx.userId, weekStart, weekEnd),
      listRecentlyCompleted(
        ctx.userId,
        fromLocalParts(weekStart, "00:00", ctx.timeZone),
      ),
      listOpenTasks(ctx.userId),
      listProjects(ctx.userId),
    ]);

    const stats = computeWeeklyStats({
      weekStart,
      blocks,
      completed,
      openTasks,
      projects,
      timeZone: ctx.timeZone,
      now,
    });

    const review = await summariseWeek(stats, weekStart);

    const { error } = await supabase.from("weekly_reviews").upsert(
      {
        user_id: ctx.userId,
        week_start: weekStart,
        stats,
        ai_summary: review.summary,
      },
      { onConflict: "user_id,week_start" },
    );
    if (error) throw error;

    revalidatePath("/review");
    return ok({
      summary: review.summary,
      focusNextWeek: review.focus_next_week,
      stats,
    });
  } catch (error) {
    return handleActionError(
      "generateWeeklyReview",
      error,
      "I couldn't write this week's summary right now.",
    );
  }
}

/**
 * Nudges the estimate multiplier toward what recent completions actually took.
 *
 * Uses the last 30 days so the model tracks the current term rather than a
 * long-gone one, and moves slowly enough that one unusual week can't skew it.
 */
async function recalibrateEstimates(userId: string, current: number) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const recent = await listRecentlyCompleted(userId, since);
  const samples = samplesFromTasks(recent);
  const updated = nextMultiplier(current, samples);

  if (updated === current) return;

  const { supabase } = await requireUser();
  await supabase
    .from("user_preferences")
    .update({ estimate_multiplier: updated })
    .eq("user_id", userId);
}
