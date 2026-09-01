"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/data/profile";
import { dateKeySchema } from "@/lib/validation/common";
import {
  buildPlan,
  loadPlanContext,
  persistPlan,
  type PlanOutcome,
} from "@/lib/planner/plan-day";
import { planDayStrategy, rescheduleStrategy } from "@/lib/ai/strategies";
import { type ActionResult, handleActionError, ok } from "./result";

const planSchema = z.object({
  dateKey: dateKeySchema.optional(),
  /** Free-text context from the user, e.g. "I only have 30 minutes now". */
  instruction: z.string().trim().max(400).optional(),
});

/**
 * "⚡ Plan My Day".
 *
 * Tries the model first and falls back to the built-in scheduler when there is
 * no API key or the call fails — the user always ends up with a plan.
 */
export async function planDay(
  input: z.input<typeof planSchema> = {},
): Promise<ActionResult<PlanOutcome>> {
  try {
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };

    const { supabase } = await requireUser();
    const ctx = await getUserContext();
    if (!ctx) return { ok: false, error: "Not signed in." };

    const planContext = await loadPlanContext(supabase, {
      userId: ctx.userId,
      profile: ctx.profile,
      preferences: ctx.preferences,
      timeZone: ctx.timeZone,
      dateKey: parsed.data.dateKey,
      instruction: parsed.data.instruction,
    });

    const strategy = parsed.data.instruction
      ? rescheduleStrategy(parsed.data.instruction)
      : planDayStrategy();

    const { plan, dropped, source } = await buildPlan(planContext, strategy);
    const blocksCreated = await persistPlan(supabase, planContext, plan.blocks);

    revalidatePath("/today");
    revalidatePath("/plan");

    return ok({
      summary: plan.summary,
      blocksCreated,
      deferred: plan.deferred,
      dropped,
      source,
    });
  } catch (error) {
    return handleActionError(
      "planDay",
      error,
      "I couldn't plan your day right now. Your tasks are safe.",
    );
  }
}

/**
 * Rebuilds the rest of the day around a constraint the user just told us
 * ("I only have 30 minutes now"). Same guarantees as `planDay`.
 */
export async function replanRestOfDay(
  instruction: string,
): Promise<ActionResult<PlanOutcome>> {
  return planDay({ instruction });
}
