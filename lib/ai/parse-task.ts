import "server-only";

import type { ParsedTask } from "@/lib/validation/task";
import { parseTaskResponseSchema } from "@/lib/validation/task";
import { wallClockIn } from "@/lib/utils/time";
import { resolveRelativeDeadline } from "@/lib/utils/deadline";
import { askStructured, isAiConfigured } from "./client";
import { TASK_PARSER_SYSTEM } from "./prompts";
import { fallbackParseTasks } from "./fallback-parse";

export interface ParseResult {
  tasks: ParsedTask[];
  clarification: string | null;
  source: "ai" | "builtin";
}

/**
 * Turns a messy thought into structured tasks.
 *
 * The model gets today's date and weekday but is asked for *relative* dates,
 * so the absolute deadline is always computed here, in the user's timezone.
 */
export async function parseTasks(
  input: string,
  opts: { now: Date; timeZone: string; todayKey: string },
): Promise<ParseResult> {
  const text = input.trim();
  if (!text) return { tasks: [], clarification: null, source: "builtin" };

  const wc = wallClockIn(opts.now, opts.timeZone);

  if (isAiConfigured()) {
    try {
      const response = await askStructured({
        schema: parseTaskResponseSchema,
        system: TASK_PARSER_SYSTEM,
        user: [
          `Today is ${opts.todayKey} (${dayName(wc.weekday)}).`,
          `Current time: ${String(wc.hour).padStart(2, "0")}:${String(wc.minute).padStart(2, "0")} (${opts.timeZone}).`,
          "",
          "The user typed:",
          JSON.stringify(text),
        ].join("\n"),
        effort: "low",
        maxTokens: 2000,
      });

      return {
        tasks: response.tasks,
        clarification: response.clarification,
        source: "ai",
      };
    } catch (error) {
      console.error("[dayos:parseTasks] falling back to rules", error);
    }
  }

  return {
    tasks: fallbackParseTasks(text, opts.now, wc.weekday),
    clarification: null,
    source: "builtin",
  };
}

/** Re-exported so callers have one import for parsing and its deadline maths. */
export const resolveDeadline = resolveRelativeDeadline;

function dayName(weekday: number): string {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][weekday];
}
