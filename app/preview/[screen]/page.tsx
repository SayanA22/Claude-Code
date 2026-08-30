import { notFound } from "next/navigation";
import { AppChrome } from "@/components/chrome/app-chrome";
import { BottomNav } from "@/components/nav/bottom-nav";
import { Sidebar } from "@/components/nav/sidebar";
import { TodayScreen } from "@/components/today/today-screen";
import { TasksScreen } from "@/components/tasks/tasks-screen";
import { PlanScreen } from "@/components/plan/plan-screen";
import { ProjectsScreen } from "@/components/projects/projects-screen";
import { ProjectDetail } from "@/components/projects/project-detail";
import { GoalsScreen } from "@/components/goals/goals-screen";
import { ReviewScreen } from "@/components/review/review-screen";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { FocusSession } from "@/components/focus/focus-session";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import * as f from "../fixtures";

/**
 * Design harness: every screen rendered against fixtures, so the interface can
 * be reviewed without a database, an account, or an API key.
 *
 * Development only — it serves invented data, which has no business being
 * reachable in production.
 */
export default async function Preview({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { screen } = await params;
  const now = f.NOW.toISOString();

  if (screen === "focus") {
    return (
      <FocusSession
        block={f.BLOCKS[1]}
        nextBlock={f.BLOCKS[3]}
        timeZone={f.TZ}
        serverNow={now}
      />
    );
  }

  if (screen === "onboarding") {
    return <OnboardingFlow defaultName="Alex" defaultTimeZone={f.TZ} />;
  }

  const body = (() => {
    switch (screen) {
      case "today":
        return (
          <TodayScreen
            blocks={f.BLOCKS}
            openTasks={f.OPEN_TASKS}
            timeZone={f.TZ}
            firstName="Alex"
            serverNow={now}
          />
        );
      case "tasks":
        return (
          <TasksScreen
            initialTasks={f.ALL_TASKS}
            todayKey={f.todayKey}
            timeZone={f.TZ}
            serverNow={now}
          />
        );
      case "plan":
        return (
          <PlanScreen
            view="day"
            anchorKey={f.todayKey}
            todayKey={f.todayKey}
            blocks={f.BLOCKS}
            fixedEvents={[
              {
                id: "school",
                title: "School",
                category: "School",
                dateKey: f.todayKey,
                startMinute: 8 * 60,
                endMinute: 15 * 60 + 20,
              },
              {
                id: "practice",
                title: "Basketball practice",
                category: "Sports",
                dateKey: f.todayKey,
                startMinute: 16 * 60,
                endMinute: 17 * 60 + 45,
              },
            ]}
            timeZone={f.TZ}
            dayStartHour={7}
            dayEndHour={23}
            serverNow={now}
          />
        );
      case "projects":
        return <ProjectsScreen projects={f.PROJECTS} todayKey={f.todayKey} />;
      case "project":
        return (
          <ProjectDetail
            project={f.PROJECT}
            tasks={f.PROJECT_TASKS}
            todayKey={f.todayKey}
            timeZone={f.TZ}
            serverNow={now}
          />
        );
      case "goals":
        return <GoalsScreen goals={f.GOALS} todayKey={f.todayKey} />;
      case "review":
        return (
          <ReviewScreen
            todayKey={f.todayKey}
            existingDaily={f.DAILY}
            existingWeekly={f.WEEKLY}
            liveStats={{
              completedCount: 3,
              postponedCount: 1,
              plannedMinutes: 195,
              actualMinutes: 145,
            }}
          />
        );
      case "profile":
        return (
          <ProfileScreen
            profile={f.PROFILE}
            preferences={f.PREFERENCES}
            email="alex@lincolnhigh.edu"
            demoEnabled
            aiEnabled
            stats={{ openTasks: 7, completedAllTime: 128 }}
          />
        );
      default:
        notFound();
    }
  })();

  return (
    <div className="min-h-svh">
      <Sidebar />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-16">
          {body}
        </main>
      </div>
      <AppChrome timeZone={f.TZ} todayKey={f.todayKey} aiEnabled />
      <BottomNav />
    </div>
  );
}
