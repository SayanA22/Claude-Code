import "server-only";

import type {
  FixedEvent,
  ScheduleBlock,
  ScheduleBlockWithTask,
  Task,
} from "@/types/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listFixedEvents(userId: string): Promise<FixedEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("fixed_events")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as FixedEvent[];
}

/** The day's plan, with each block's task joined in. */
export async function listBlocksForDate(
  userId: string,
  localDate: string,
): Promise<ScheduleBlockWithTask[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("*, task:tasks(*)")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { task, ...block } = row as ScheduleBlock & { task: Task | null };
    return { ...block, task: task ?? null };
  });
}

export async function listBlocksInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<ScheduleBlockWithTask[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("*, task:tasks(*)")
    .eq("user_id", userId)
    .gte("local_date", startDate)
    .lte("local_date", endDate)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { task, ...block } = row as ScheduleBlock & { task: Task | null };
    return { ...block, task: task ?? null };
  });
}
