import "server-only";

import type { WeeklyReviewStats } from "@/types/db";
import type { DailyStats } from "@/lib/data/reviews";
import { formatDuration } from "@/lib/utils/time";
import { askStructured, isAiConfigured } from "./client";
import { DAILY_REVIEW_SYSTEM, WEEKLY_REVIEW_SYSTEM } from "./prompts";
import {
  dailyReviewSchema,
  weeklyReviewSchema,
  type DailyReviewOutput,
  type WeeklyReviewOutput,
} from "./schemas";

/**
 * End-of-day and end-of-week summaries.
 *
 * Both are written from counted statistics. The prompts hold the model to
 * productivity observations only — nothing about the user as a person.
 */

export async function summariseDay(
  stats: DailyStats,
  reflection: string | null,
): Promise<DailyReviewOutput> {
  if (!isAiConfigured()) return fallbackDaily(stats);

  const prompt = [
    `Date: ${stats.dateKey}`,
    `Tasks completed: ${stats.completedCount}`,
    stats.completedTitles.length
      ? `  ${stats.completedTitles.join(", ")}`
      : "",
    `Sessions postponed or skipped: ${stats.postponedCount}`,
    stats.postponedTitles.length
      ? `  ${stats.postponedTitles.join(", ")}`
      : "",
    `Planned time: ${formatDuration(stats.plannedMinutes)}`,
    `Time actually worked: ${formatDuration(stats.actualMinutes)}`,
    stats.estimateSamples.length
      ? `Estimated vs actual:\n${stats.estimateSamples
          .map((s) => `  - ${s.title}: estimated ${s.estimated}m, took ${s.actual}m`)
          .join("\n")}`
      : "No estimate-vs-actual data today.",
    reflection ? `\nThe user wrote: ${JSON.stringify(reflection)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    return await askStructured({
      schema: dailyReviewSchema,
      system: DAILY_REVIEW_SYSTEM,
      user: prompt,
      effort: "low",
      maxTokens: 1200,
    });
  } catch (error) {
    console.error("[dayos:summariseDay] falling back", error);
    return fallbackDaily(stats);
  }
}

export async function summariseWeek(
  stats: WeeklyReviewStats,
  weekStart: string,
): Promise<WeeklyReviewOutput> {
  if (!isAiConfigured()) return fallbackWeekly(stats);

  const prompt = [
    `Week beginning: ${weekStart}`,
    `Planned sessions: ${stats.planned}`,
    `Completion rate: ${stats.completionRate}%`,
    `Tasks completed: ${stats.completed}`,
    `Planned time: ${formatDuration(stats.plannedMinutes)}`,
    `Time worked: ${formatDuration(stats.actualMinutes)}`,
    "",
    "Upcoming deadlines:",
    stats.upcomingDeadlines.length
      ? stats.upcomingDeadlines
          .map((d) => `  - ${d.title} — ${d.deadline}`)
          .join("\n")
      : "  (none)",
    "",
    "Most postponed:",
    stats.mostPostponed.length
      ? stats.mostPostponed
          .map((t) => `  - ${t.title} (${t.count}x)`)
          .join("\n")
      : "  (none)",
    "",
    "Project progress:",
    stats.projectProgress.length
      ? stats.projectProgress
          .map((p) => `  - ${p.title}: ${p.progress}%`)
          .join("\n")
      : "  (none)",
  ].join("\n");

  try {
    return await askStructured({
      schema: weeklyReviewSchema,
      system: WEEKLY_REVIEW_SYSTEM,
      user: prompt,
      effort: "low",
      maxTokens: 1500,
    });
  } catch (error) {
    console.error("[dayos:summariseWeek] falling back", error);
    return fallbackWeekly(stats);
  }
}

function fallbackDaily(stats: DailyStats): DailyReviewOutput {
  const parts = [
    stats.completedCount
      ? `You finished ${stats.completedCount} ${stats.completedCount === 1 ? "task" : "tasks"} (${formatDuration(stats.actualMinutes)}).`
      : "Nothing was completed today.",
  ];
  if (stats.postponedCount) {
    parts.push(
      `${stats.postponedCount} ${stats.postponedCount === 1 ? "session" : "sessions"} didn't happen — they'll be first in line tomorrow.`,
    );
  }

  const gap = estimateGap(stats);
  return {
    summary: parts.join(" "),
    estimate_note: gap,
  };
}

function fallbackWeekly(stats: WeeklyReviewStats): WeeklyReviewOutput {
  const next = stats.upcomingDeadlines[0];
  return {
    summary: [
      `You completed ${stats.completionRate}% of your planned sessions this week (${stats.completed} tasks, ${formatDuration(stats.actualMinutes)} of work).`,
      next
        ? `Next up: ${next.title}, due ${next.deadline}.`
        : "Nothing has a deadline in the near term.",
      stats.mostPostponed[0]
        ? `${stats.mostPostponed[0].title} has been pushed ${stats.mostPostponed[0].count} times — worth either doing or dropping.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    focus_next_week: next ? next.title : null,
  };
}

/** A factual note about estimates, or nothing. */
function estimateGap(stats: DailyStats): string | null {
  if (stats.estimateSamples.length < 2) return null;
  const estimated = stats.estimateSamples.reduce((s, x) => s + x.estimated, 0);
  const actual = stats.estimateSamples.reduce((s, x) => s + x.actual, 0);
  const ratio = actual / estimated;
  if (ratio > 1.25) {
    return `Today's work took about ${Math.round((ratio - 1) * 100)}% longer than estimated. DayOS will pad future estimates a little.`;
  }
  if (ratio < 0.8) {
    return `You finished faster than estimated today. DayOS will tighten future estimates a little.`;
  }
  return null;
}
