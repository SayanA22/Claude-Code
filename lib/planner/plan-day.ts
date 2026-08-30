import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FixedEvent,
  Profile,
  ScheduleBlock,
  Task,
  UserPreferences,
} from "@/types/db";
import { localDateKey } from "@/lib/utils/time";
import { computeAvailability } from "./availability";
import { generateSchedule, type GeneratedPlan, type PlannedBlock } from "./generate";
import { assertNoOverlaps, repairSchedule } from "./repair";

/**
 * Orchestrates a full replan for one day.
 *
 * The flow is the same whether the plan came from the model or the built-in
 * scheduler: gather state → compute what time is actually free → produce
 * blocks → validate them against that free time → persist atomically.
 *
 * Blocks that are already completed, in progress or skipped are never touched;
 * only `planned` blocks are replaced, so a replan mid-afternoon can't erase
 * what the user already did.
 */

export interface PlanContext {
  userId: string;
  dateKey: string;
  timeZone: string;
  now: Date;
  profile: Profile;
  preferences: UserPreferences;
  tasks: Task[];
  fixedEvents: FixedEvent[];
  keptBlocks: ScheduleBlock[];
}

export interface PlanOutcome {
  summary: string;
  blocksCreated: number;
  deferred: { taskId: string; title: string; reason: string }[];
  /** Blocks a model proposed that failed validation and were dropped. */
  dropped: { title: string; reason: string }[];
  source: "ai" | "builtin";
}

/** A planner implementation: given the context and free time, propose blocks. */
export type PlanStrategy = (
  ctx: PlanContext,
  availability: ReturnType<typeof computeAvailability>,
) => Promise<GeneratedPlan | null>;

export async function loadPlanContext(
  supabase: SupabaseClient,
  args: {
    userId: string;
    profile: Profile;
    preferences: UserPreferences;
    timeZone: string;
    dateKey?: string;
    now?: Date;
  },
): Promise<PlanContext> {
  const now = args.now ?? new Date();
  const dateKey = args.dateKey ?? localDateKey(now, args.timeZone);

  const [tasksRes, eventsRes, blocksRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", args.userId)
      .in("status", ["todo", "in_progress"]),
    supabase.from("fixed_events").select("*").eq("user_id", args.userId),
    supabase
      .from("schedule_blocks")
      .select("*")
      .eq("user_id", args.userId)
      .eq("local_date", dateKey),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (blocksRes.error) throw blocksRes.error;

  const allBlocks = (blocksRes.data ?? []) as ScheduleBlock[];
  const keptBlocks = allBlocks.filter(
    (b) =>
      b.status === "completed" ||
      b.status === "in_progress" ||
      b.status === "skipped" ||
      // A planned block already under way by wall clock is left alone too.
      new Date(b.start_at).getTime() <= now.getTime(),
  );

  return {
    userId: args.userId,
    dateKey,
    timeZone: args.timeZone,
    now,
    profile: args.profile,
    preferences: args.preferences,
    tasks: (tasksRes.data ?? []) as Task[],
    fixedEvents: (eventsRes.data ?? []) as FixedEvent[],
    keptBlocks,
  };
}

export function availabilityFor(ctx: PlanContext) {
  return computeAvailability({
    dateKey: ctx.dateKey,
    timeZone: ctx.timeZone,
    profile: ctx.profile,
    preferences: ctx.preferences,
    fixedEvents: ctx.fixedEvents,
    busyBlocks: ctx.keptBlocks,
    notBefore: ctx.now,
  });
}

/**
 * Runs `strategy`, validates whatever it produced, and falls back to the
 * built-in scheduler if it produced nothing usable.
 */
export async function buildPlan(
  ctx: PlanContext,
  strategy?: PlanStrategy,
): Promise<{
  plan: GeneratedPlan;
  dropped: { title: string; reason: string }[];
  source: "ai" | "builtin";
}> {
  const availability = availabilityFor(ctx);

  const builtin = () =>
    generateSchedule({
      tasks: ctx.tasks,
      free: availability.free,
      preferences: ctx.preferences,
      now: ctx.now,
    });

  let source: "ai" | "builtin" = "builtin";
  let proposal: GeneratedPlan | null = null;

  if (strategy) {
    try {
      proposal = await strategy(ctx, availability);
      if (proposal) source = "ai";
    } catch (error) {
      console.error("[dayos:plan] strategy failed, using built-in", error);
      proposal = null;
    }
  }

  if (!proposal) proposal = builtin();

  const knownTaskIds = new Set(ctx.tasks.map((t) => t.id));
  const titles = new Map(ctx.tasks.map((t) => [t.id, t.title]));

  const { blocks, dropped } = repairSchedule({
    blocks: proposal.blocks,
    free: availability.free,
    knownTaskIds,
    titles,
    now: ctx.now,
  });

  // If the model's plan collapsed under validation, fall back rather than
  // showing the user an almost-empty day.
  if (source === "ai" && blocks.filter((b) => b.kind === "task").length === 0) {
    const fallback = builtin();
    const repaired = repairSchedule({
      blocks: fallback.blocks,
      free: availability.free,
      knownTaskIds,
      titles,
      now: ctx.now,
    });
    return {
      plan: { ...fallback, blocks: repaired.blocks },
      dropped: [...dropped, ...repaired.dropped],
      source: "builtin",
    };
  }

  assertNoOverlaps(blocks);
  return { plan: { ...proposal, blocks }, dropped, source };
}

/** Replaces the day's planned blocks with `blocks`, keeping finished work. */
export async function persistPlan(
  supabase: SupabaseClient,
  ctx: PlanContext,
  blocks: PlannedBlock[],
): Promise<number> {
  const keptIds = new Set(ctx.keptBlocks.map((b) => b.id));

  const { data: existing, error: readError } = await supabase
    .from("schedule_blocks")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("local_date", ctx.dateKey);
  if (readError) throw readError;

  const toDelete = (existing ?? [])
    .map((b) => b.id as string)
    .filter((id) => !keptIds.has(id));

  if (toDelete.length) {
    const { error } = await supabase
      .from("schedule_blocks")
      .delete()
      .eq("user_id", ctx.userId)
      .in("id", toDelete);
    if (error) throw error;
  }

  if (!blocks.length) return 0;

  const rows = blocks.map((b) => ({
    user_id: ctx.userId,
    task_id: b.taskId,
    title: b.title,
    kind: b.kind,
    status: "planned" as const,
    start_at: new Date(b.start).toISOString(),
    end_at: new Date(b.end).toISOString(),
    local_date: ctx.dateKey,
    reason: b.reason,
  }));

  const { error } = await supabase.from("schedule_blocks").insert(rows);
  if (error) throw error;

  return rows.length;
}
