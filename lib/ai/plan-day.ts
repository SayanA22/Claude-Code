import "server-only";

import type { GeneratedPlan, PlannedBlock } from "@/lib/planner/generate";
import type { PlanContext } from "@/lib/planner/plan-day";
import type { computeAvailability } from "@/lib/planner/availability";
import {
  addDaysToKey,
  formatClock,
  fromLocalParts,
  formatDuration,
} from "@/lib/utils/time";
import { totalMinutes } from "@/lib/planner/intervals";
import { askStructured } from "./client";
import { PLANNER_SYSTEM, RESCHEDULER_SYSTEM } from "./prompts";
import { planResponseSchema } from "./schemas";
import {
  describeBlocks,
  describeFixed,
  describeTasks,
  describeWindows,
} from "./context";

type Availability = ReturnType<typeof computeAvailability>;

/**
 * Asks the model for today's schedule.
 *
 * Returns a plan in DayOS's internal shape; the caller still runs it through
 * `repairSchedule`, which is what actually enforces the constraints the prompt
 * describes.
 */
export async function aiPlanDay(
  ctx: PlanContext,
  availability: Availability,
  instruction?: string,
): Promise<GeneratedPlan> {
  const prompt = buildPrompt(ctx, availability, instruction);

  const response = await askStructured({
    schema: planResponseSchema,
    system: instruction ? RESCHEDULER_SYSTEM : PLANNER_SYSTEM,
    user: prompt,
    // Scheduling is the hardest judgement DayOS asks for; give it room.
    effort: "high",
    maxTokens: 8000,
  });

  const titles = new Map(ctx.tasks.map((t) => [t.id, t.title]));

  const blocks: PlannedBlock[] = response.schedule.map((b) => {
    const dateKey = addDaysToKey(ctx.dateKey, b.day_offset);
    const start = fromLocalParts(dateKey, b.start, ctx.timeZone).getTime();
    let end = fromLocalParts(dateKey, b.end, ctx.timeZone).getTime();
    // An end before its start means the block runs past midnight.
    if (end <= start) {
      end = fromLocalParts(
        addDaysToKey(dateKey, 1),
        b.end,
        ctx.timeZone,
      ).getTime();
    }

    return {
      taskId: b.kind === "task" ? b.taskId : null,
      title:
        b.kind === "break"
          ? "Break"
          : (titles.get(b.taskId ?? "") ?? "Untitled"),
      kind: b.kind,
      start,
      end,
      reason: b.reason,
    };
  });

  const deferred = response.deferred
    .filter((d) => titles.has(d.taskId))
    .map((d) => ({
      taskId: d.taskId,
      title: titles.get(d.taskId) as string,
      reason: d.reason,
    }));

  return { summary: response.summary, blocks, deferred };
}

function buildPrompt(
  ctx: PlanContext,
  availability: Availability,
  instruction?: string,
): string {
  const freeMinutes = totalMinutes(availability.free);

  return [
    `Current date: ${ctx.dateKey} (${ctx.timeZone})`,
    `Current time: ${formatClock(ctx.now, ctx.timeZone)}`,
    "",
    "USER PREFERENCES",
    `- Focus session length: ${ctx.preferences.focus_session_minutes} minutes`,
    `- Break length: ${ctx.preferences.break_minutes} minutes`,
    `- Works best in the: ${ctx.preferences.energy_peak}`,
    `- Awake ${ctx.profile.wake_time.slice(0, 5)} to ${ctx.profile.bed_time.slice(0, 5)}`,
    ctx.preferences.estimate_multiplier !== 1
      ? `- This user historically takes ${Math.round(ctx.preferences.estimate_multiplier * 100)}% of their own estimates; plan sessions accordingly.`
      : "",
    "",
    "FIXED COMMITMENTS TODAY (already excluded from free time — never schedule over these)",
    describeFixed(availability.fixed, ctx.timeZone),
    "",
    "ALREADY ON TODAY'S SCHEDULE (keep — do not move or duplicate)",
    describeBlocks(ctx.keptBlocks, ctx.timeZone),
    "",
    `FREE TIME AVAILABLE (${formatDuration(freeMinutes)} total). Every block you create must fit inside one of these windows:`,
    describeWindows(availability.free, ctx.timeZone),
    "",
    "OPEN TASKS",
    describeTasks(ctx.tasks, ctx.now, ctx.timeZone),
    "",
    instruction
      ? `WHAT THE USER JUST SAID:\n${JSON.stringify(instruction)}\n`
      : "",
    "Produce today's schedule. Times are wall-clock in the user's timezone, in HH:MM 24-hour form.",
  ]
    .filter(Boolean)
    .join("\n");
}
