import { redirect } from "next/navigation";
import { TasksScreen } from "@/components/tasks/tasks-screen";
import { getUserContext } from "@/lib/data/profile";
import { listAllTasks } from "@/lib/data/tasks";
import { localDateKey } from "@/lib/utils/time";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const now = new Date();
  const tasks = await listAllTasks(ctx.userId);
  const todayKey = localDateKey(now, ctx.timeZone);

  return (
    <TasksScreen
      initialTasks={tasks}
      todayKey={todayKey}
      timeZone={ctx.timeZone}
      serverNow={now.toISOString()}
    />
  );
}
