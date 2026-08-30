import { redirect } from "next/navigation";
import { NotificationRunner } from "@/components/notifications/notification-runner";
import { TodayScreen } from "@/components/today/today-screen";
import { getUserContext, displayName } from "@/lib/data/profile";
import { listOpenTasks } from "@/lib/data/tasks";
import { listBlocksForDate } from "@/lib/data/schedule";
import { localDateKey } from "@/lib/utils/time";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const now = new Date();
  const todayKey = localDateKey(now, ctx.timeZone);

  const [blocks, openTasks] = await Promise.all([
    listBlocksForDate(ctx.userId, todayKey),
    listOpenTasks(ctx.userId),
  ]);

  return (
    <>
      <TodayScreen
        blocks={blocks}
        openTasks={openTasks}
        timeZone={ctx.timeZone}
        firstName={displayName(ctx.profile)}
        serverNow={now.toISOString()}
      />
      {/* Schedules the day's reminders while the app is open or installed. */}
      <NotificationRunner
        blocks={blocks}
        tasks={openTasks}
        prefs={ctx.preferences.notifications}
        timeZone={ctx.timeZone}
        serverNow={now.toISOString()}
      />
    </>
  );
}
