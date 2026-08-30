import "server-only";

import type { Task } from "@/types/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OPEN_STATUSES = ["todo", "in_progress"] as const;

/** Every task that could still be scheduled. */
export async function listOpenTasks(userId: string): Promise<Task[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .in("status", OPEN_STATUSES as unknown as string[])
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function listAllTasks(
  userId: string,
  opts: { limit?: number } = {},
): Promise<Task[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 500);

  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function listTasksForProject(
  userId: string,
  projectId: string,
): Promise<Task[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Task[];
}

/** Tasks completed since `since`, used for review + estimate calibration. */
export async function listRecentlyCompleted(
  userId: string,
  since: Date,
): Promise<Task[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("completed_at", since.toISOString())
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function getTask(
  userId: string,
  taskId: string,
): Promise<Task | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("id", taskId)
    .maybeSingle();
  return (data as Task | null) ?? null;
}
