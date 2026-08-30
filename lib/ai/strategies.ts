import "server-only";

import type { PlanStrategy } from "@/lib/planner/plan-day";
import { isAiConfigured } from "./client";
import { aiPlanDay } from "./plan-day";

/**
 * Adapters between the planner's `PlanStrategy` contract and the AI module.
 *
 * Returning `null` means "no model available" — the caller then uses the
 * built-in scheduler, which is why DayOS works end to end with no API key.
 */

export function planDayStrategy(): PlanStrategy {
  return async (ctx, availability) => {
    if (!isAiConfigured()) return null;
    return aiPlanDay(ctx, availability);
  };
}

export function rescheduleStrategy(instruction: string): PlanStrategy {
  return async (ctx, availability) => {
    if (!isAiConfigured()) return null;
    return aiPlanDay(ctx, availability, instruction);
  };
}
