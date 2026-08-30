import "server-only";

import type { Task } from "@/types/db";
import { daysBetweenKeys, formatDuration } from "@/lib/utils/time";
import { askStructured, isAiConfigured } from "./client";
import { PROJECT_BREAKDOWN_SYSTEM } from "./prompts";
import { projectBreakdownSchema, type ProjectBreakdown } from "./schemas";

/**
 * The shape of anything DayOS can break into tasks. `Project` satisfies it
 * structurally, and a goal is adapted to it by the goals actions.
 */
export interface BreakdownSubject {
  title: string;
  description: string | null;
  category: string;
  deadline: string | null;
}

/**
 * Breaks a project (or goal) into tasks the user can actually sit down and do.
 *
 * Like every other write path, the result is a proposal: the screen shows it
 * for review and only writes what the user keeps.
 */
export async function breakDownProject(
  project: BreakdownSubject,
  existingTasks: Task[],
  opts: { todayKey: string; focusMinutes: number },
): Promise<ProjectBreakdown> {
  if (!isAiConfigured()) return fallbackBreakdown(project, opts.focusMinutes);

  const daysLeft = project.deadline
    ? daysBetweenKeys(opts.todayKey, project.deadline)
    : null;

  const prompt = [
    `Today: ${opts.todayKey}`,
    `Project: ${JSON.stringify(project.title)}`,
    project.description
      ? `Description: ${JSON.stringify(project.description)}`
      : "Description: (none given)",
    `Category: ${project.category}`,
    project.deadline
      ? `Deadline: ${project.deadline} (${daysLeft} days away)`
      : "Deadline: none",
    `The user's preferred focus session is ${opts.focusMinutes} minutes.`,
    "",
    "Tasks that already exist for this project (don't duplicate them):",
    existingTasks.length
      ? existingTasks
          .map((t) => `- ${t.title} [${t.status}]`)
          .join("\n")
      : "(none yet)",
  ].join("\n");

  try {
    return await askStructured({
      schema: projectBreakdownSchema,
      system: PROJECT_BREAKDOWN_SYSTEM,
      user: prompt,
      effort: "medium",
      maxTokens: 3000,
    });
  } catch (error) {
    console.error("[dayos:breakDownProject] falling back", error);
    return fallbackBreakdown(project, opts.focusMinutes);
  }
}

/**
 * The no-API-key path: a generic but honest project skeleton.
 *
 * It doesn't pretend to know anything about this specific project — it
 * proposes the stages most projects share, for the user to rename.
 */
function fallbackBreakdown(
  project: BreakdownSubject,
  focusMinutes: number,
): ProjectBreakdown {
  const session = Math.min(90, Math.max(20, focusMinutes));
  const stages: [string, string][] = [
    ["Outline what done looks like", "Write down the finished result and what it needs to include."],
    ["Gather what you need", "Collect sources, materials or references in one place."],
    ["First pass", "Get a rough version end to end — quality comes later."],
    ["Build it out", "Fill in the parts the first pass skipped."],
    ["Review and fix", "Read it as if someone else made it, then fix what's weak."],
    ["Finish and hand in", "Final formatting, then submit."],
  ];

  return {
    summary: `A starting skeleton for ${project.title}. Rename anything that doesn't fit — this was generated without a model, so it doesn't know the specifics. Roughly ${formatDuration(session * stages.length)} in total.`,
    tasks: stages.map(([title, description], index) => ({
      title,
      description,
      estimated_duration: session,
      priority: index < 2 ? ("high" as const) : ("medium" as const),
      deadline_days_from_today: null,
    })),
  };
}
