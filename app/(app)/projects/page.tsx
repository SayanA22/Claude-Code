import { redirect } from "next/navigation";
import { ProjectsScreen } from "@/components/projects/projects-screen";
import { getUserContext } from "@/lib/data/profile";
import { listProjects } from "@/lib/data/projects";
import { localDateKey } from "@/lib/utils/time";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const projects = await listProjects(ctx.userId);

  return (
    <ProjectsScreen
      projects={projects}
      todayKey={localDateKey(new Date(), ctx.timeZone)}
    />
  );
}
