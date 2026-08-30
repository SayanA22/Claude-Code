import "server-only";

import type { Goal, GoalMilestone, Project, Task } from "@/types/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ProjectWithProgress extends Project {
  taskCount: number;
  completedCount: number;
  progress: number;
}

/** Progress is derived from tasks, never stored, so it can't drift. */
export function withProgress(project: Project, tasks: Task[]): ProjectWithProgress {
  const relevant = tasks.filter((t) => t.status !== "archived");
  const done = relevant.filter((t) => t.status === "completed").length;
  return {
    ...project,
    taskCount: relevant.length,
    completedCount: done,
    progress: relevant.length ? Math.round((done / relevant.length) * 100) : 0,
  };
}

export async function listProjects(
  userId: string,
): Promise<ProjectWithProgress[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: projects, error }, { data: tasks }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, project_id, status")
      .eq("user_id", userId)
      .not("project_id", "is", null),
  ]);

  if (error) throw error;

  const byProject = new Map<string, Task[]>();
  for (const t of (tasks ?? []) as Task[]) {
    if (!t.project_id) continue;
    const list = byProject.get(t.project_id) ?? [];
    list.push(t);
    byProject.set(t.project_id, list);
  }

  return ((projects ?? []) as Project[]).map((p) =>
    withProgress(p, byProject.get(p.id) ?? []),
  );
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<Project | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("id", projectId)
    .maybeSingle();
  return (data as Project | null) ?? null;
}

export interface GoalWithDetail extends Goal {
  milestones: GoalMilestone[];
  taskIds: string[];
  progress: number;
}

export async function listGoals(userId: string): Promise<GoalWithDetail[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: goals, error }, { data: milestones }, { data: links }] =
    await Promise.all([
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .neq("status", "archived")
        .order("created_at", { ascending: false }),
      supabase
        .from("goal_milestones")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true }),
      supabase
        .from("goal_tasks")
        .select("goal_id, task_id, task:tasks(id, status)")
        .eq("user_id", userId),
    ]);

  if (error) throw error;

  type Link = {
    goal_id: string;
    task_id: string;
    task: { id: string; status: string } | null;
  };

  return ((goals ?? []) as Goal[]).map((goal) => {
    const goalMilestones = ((milestones ?? []) as GoalMilestone[]).filter(
      (m) => m.goal_id === goal.id,
    );
    const goalLinks = ((links ?? []) as unknown as Link[]).filter(
      (l) => l.goal_id === goal.id,
    );

    // Progress blends milestone completion with linked-task completion, so a
    // goal shows movement whichever way the user tracks it.
    const units: number[] = [
      ...goalMilestones.map((m) => (m.completed ? 1 : 0)),
      ...goalLinks.map((l) => (l.task?.status === "completed" ? 1 : 0)),
    ];
    const progress = units.length
      ? Math.round((units.reduce((a, b) => a + b, 0) / units.length) * 100)
      : 0;

    return {
      ...goal,
      milestones: goalMilestones,
      taskIds: goalLinks.map((l) => l.task_id),
      progress,
    };
  });
}
