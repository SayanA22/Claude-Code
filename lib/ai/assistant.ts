import "server-only";

import type { Goal, Project, ScheduleBlockWithTask, Task } from "@/types/db";
import type { Interval } from "@/lib/planner/intervals";
import { totalMinutes } from "@/lib/planner/intervals";
import { rankTasks } from "@/lib/planner/priority";
import { formatClock, formatDuration } from "@/lib/utils/time";
import { askStructured } from "./client";
import { ASSISTANT_SYSTEM } from "./prompts";
import { assistantResponseSchema, type AssistantResponse } from "./schemas";
import { describeBlocks, describeTasks, describeWindows } from "./context";

/**
 * The DayOS assistant.
 *
 * It is not a general chatbot: the user's real tasks, schedule, projects, goals
 * and remaining free time are assembled server-side and handed to the model
 * with every question, and the model may only reference ids from that payload.
 * It proposes actions; the application executes them, after confirmation.
 */

export interface AssistantContext {
  now: Date;
  timeZone: string;
  dateKey: string;
  firstName: string;
  tasks: Task[];
  blocks: ScheduleBlockWithTask[];
  projects: Project[];
  goals: Goal[];
  free: Interval[];
  focusMinutes: number;
}

export async function askAssistant(
  question: string,
  ctx: AssistantContext,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<AssistantResponse> {
  const ranked = rankTasks(ctx.tasks, { now: ctx.now, allTasks: ctx.tasks });
  const remainingWork = ctx.tasks.reduce(
    (sum, t) => sum + t.estimated_duration,
    0,
  );
  const freeMinutes = totalMinutes(ctx.free);

  const payload = [
    `Current date: ${ctx.dateKey} (${ctx.timeZone})`,
    `Current time: ${formatClock(ctx.now, ctx.timeZone)}`,
    `User: ${ctx.firstName}`,
    `Preferred focus session: ${ctx.focusMinutes} minutes`,
    "",
    "TODAY'S SCHEDULE",
    describeBlocks(ctx.blocks, ctx.timeZone),
    "",
    `FREE TIME REMAINING TODAY (${formatDuration(freeMinutes)} total)`,
    describeWindows(ctx.free, ctx.timeZone),
    "",
    `OPEN TASKS (${ctx.tasks.length}, ${formatDuration(remainingWork)} of estimated work), highest priority score first`,
    describeTasks(ranked, ctx.now, ctx.timeZone),
    "",
    "PROJECTS",
    ctx.projects.length
      ? ctx.projects
          .map(
            (p) =>
              `- id=${p.id} title=${JSON.stringify(p.title)} deadline=${p.deadline ?? "none"} status=${p.status}`,
          )
          .join("\n")
      : "(none)",
    "",
    "GOALS",
    ctx.goals.length
      ? ctx.goals
          .map(
            (g) =>
              `- id=${g.id} title=${JSON.stringify(g.title)} deadline=${g.deadline ?? "none"}`,
          )
          .join("\n")
      : "(none)",
    "",
    history.length
      ? `EARLIER IN THIS CONVERSATION\n${history
          .slice(-6)
          .map((m) => `${m.role === "user" ? "User" : "You"}: ${m.content}`)
          .join("\n")}\n`
      : "",
    "QUESTION",
    JSON.stringify(question),
  ]
    .filter(Boolean)
    .join("\n");

  return askStructured({
    schema: assistantResponseSchema,
    system: ASSISTANT_SYSTEM,
    user: payload,
    effort: "medium",
    maxTokens: 3000,
  });
}

/**
 * The answer DayOS gives without a model configured.
 *
 * It handles the question the product exists for — "what should I do right
 * now?" — from the same data the model would have seen, and is honest when it
 * can't answer the rest.
 */
export function fallbackAssistantAnswer(
  question: string,
  ctx: AssistantContext,
): AssistantResponse {
  const q = question.toLowerCase();
  const ranked = rankTasks(ctx.tasks, { now: ctx.now, allTasks: ctx.tasks });
  const freeMinutes = totalMinutes(ctx.free);
  const nowMs = ctx.now.getTime();

  const current = ctx.blocks.find(
    (b) =>
      b.kind !== "break" &&
      new Date(b.start_at).getTime() <= nowMs &&
      new Date(b.end_at).getTime() > nowMs &&
      b.status !== "completed" &&
      b.status !== "skipped",
  );
  const next = ctx.blocks.find(
    (b) =>
      b.kind !== "break" &&
      new Date(b.start_at).getTime() > nowMs &&
      b.status === "planned",
  );

  if (/right now|what should i do|next|start/.test(q)) {
    if (current) {
      return answer(
        `You're in ${current.title} until ${formatClock(new Date(current.end_at), ctx.timeZone)}.`,
      );
    }
    if (next) {
      return answer(
        `${next.title} at ${formatClock(new Date(next.start_at), ctx.timeZone)} is up next.`,
      );
    }
    if (ranked[0]) {
      return answer(
        `Nothing is scheduled right now. ${ranked[0].title} is the highest-value thing you could pick up — about ${formatDuration(ranked[0].estimated_duration)}.`,
      );
    }
    return answer("You're all clear — nothing open.");
  }

  if (/behind|overdue|late/.test(q)) {
    const overdue = ctx.tasks.filter(
      (t) => t.deadline && new Date(t.deadline).getTime() < nowMs,
    );
    return answer(
      overdue.length
        ? `${overdue.length} past due: ${overdue.slice(0, 3).map((t) => t.title).join(", ")}.`
        : "Nothing is past due.",
    );
  }

  if (/finish everything|fit|enough time|can i/.test(q)) {
    const work = ctx.tasks.reduce((s, t) => s + t.estimated_duration, 0);
    return answer(
      work <= freeMinutes
        ? `Yes — ${formatDuration(work)} of work against ${formatDuration(freeMinutes)} free.`
        : `Not today. You have ${formatDuration(work)} of work and ${formatDuration(freeMinutes)} free, so about ${formatDuration(work - freeMinutes)} has to move.`,
    );
  }

  return answer(
    "I need an API key configured to answer that one. Try asking what you should do right now — I can answer that from your schedule.",
  );
}

function answer(text: string): AssistantResponse {
  return { answer: text, actions: [] };
}
