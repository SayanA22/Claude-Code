import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ProjectDetail } from "@/components/projects/project-detail";
import { getUserContext } from "@/lib/data/profile";
import { getProject } from "@/lib/data/projects";
import { listTasksForProject } from "@/lib/data/tasks";
import { localDateKey } from "@/lib/utils/time";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getUserContext();
  if (!ctx) return { title: "Project" };
  const project = await getProject(ctx.userId, id);
  return { title: project?.title ?? "Project" };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const project = await getProject(ctx.userId, id);
  if (!project) notFound();

  const now = new Date();
  const tasks = await listTasksForProject(ctx.userId, id);

  return (
    <ProjectDetail
      project={project}
      tasks={tasks}
      todayKey={localDateKey(now, ctx.timeZone)}
      timeZone={ctx.timeZone}
      serverNow={now.toISOString()}
    />
  );
}
