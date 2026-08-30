import type {
  DailyReview,
  Goal,
  GoalMilestone,
  Profile,
  Project,
  ScheduleBlockWithTask,
  Task,
  UserPreferences,
  WeeklyReview,
} from "@/types/db";

export const TZ = "America/New_York";
export const NOW = new Date();
export const todayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(NOW);

export const m = (mins: number) =>
  new Date(NOW.getTime() + mins * 60_000).toISOString();
export const d = (days: number) => {
  const [y, mo, da] = todayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, mo - 1, da + days));
  return shifted.toISOString().slice(0, 10);
};

export function task(
  id: string,
  title: string,
  category: string,
  mins: number,
  priority: Task["priority"],
  deadline: string | null,
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    user_id: "u",
    project_id: null,
    title,
    description: null,
    category,
    priority,
    deadline,
    estimated_duration: mins,
    actual_duration: null,
    recurring: null,
    status: "todo",
    notes: null,
    postpone_count: 0,
    depends_on: [],
    completed_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...extra,
  };
}

export const aphug = task("a", "AP Human Geography — Chapter 3 notes", "School", 45, "high", m(20 * 60));
export const math = task("m", "Study for Friday math test", "School", 60, "critical", m(44 * 60));
export const piano = task("p", "Piano practice", "Music", 30, "medium", null);
export const ball = task("b", "Basketball conditioning workout", "Fitness", 45, "medium", null);
export const code = task("c", "Work on habit tracker UI", "Coding", 60, "medium", null, { project_id: "p2" });
export const bio = task("bi", "Biology reading — Chapter 7", "School", 40, "medium", m(30 * 60), { postpone_count: 2 });
export const essay = task("e", "English essay outline", "School", 35, "high", m(70 * 60));
export const design = task("dx", "Design the experiment", "School", 60, "high", m(96 * 60), { project_id: "p1" });
export const collect = task("co", "Collect week 1 data", "School", 45, "medium", m(280 * 60), { project_id: "p1" });
export const doneTask = task("z", "Finish history reading", "School", 30, "medium", null, {
  status: "completed",
  completed_at: m(-120),
  actual_duration: 40,
});

export const ALL_TASKS = [aphug, math, piano, ball, code, bio, essay, doneTask];
export const OPEN_TASKS = [aphug, math, piano, ball, code, bio, essay];

export function block(
  id: string,
  title: string,
  start: string,
  end: string,
  status: ScheduleBlockWithTask["status"],
  t: Task | null,
  kind: ScheduleBlockWithTask["kind"] = "task",
  reason: string | null = null,
): ScheduleBlockWithTask {
  return {
    id,
    user_id: "u",
    task_id: t?.id ?? null,
    title,
    kind,
    status,
    start_at: start,
    end_at: end,
    local_date: todayKey,
    reason,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    task: t,
  };
}

export const BLOCKS: ScheduleBlockWithTask[] = [
  block("b0", "Piano practice", m(-90), m(-60), "completed", piano),
  block("b1", "AP Human Geography — Chapter 3 notes", m(13), m(48), "planned", aphug, "task", "Due tomorrow"),
  block("b2", "Break", m(48), m(58), "planned", null, "break", "Reset before the next session"),
  block("b3", "Study for Friday math test", m(58), m(103), "planned", math, "task", "Test on Friday"),
  block("b4", "Break", m(103), m(113), "planned", null, "break", "Reset before the next session"),
  block("b5", "Work on habit tracker UI", m(113), m(173), "planned", code, "task", "Fits the open time"),
];

export const PROJECTS = [
  {
    id: "p1",
    user_id: "u",
    goal_id: null,
    title: "Science Research Project",
    description:
      "Independent research project for Biology — experiment, poster and written report.",
    category: "School",
    deadline: d(26),
    status: "active" as const,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    taskCount: 6,
    completedCount: 2,
    progress: 33,
  },
  {
    id: "p2",
    user_id: "u",
    goal_id: null,
    title: "Personal App",
    description: "A habit tracker I'm building to learn React properly.",
    category: "Coding",
    deadline: d(60),
    status: "active" as const,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    taskCount: 5,
    completedCount: 1,
    progress: 20,
  },
];

export const PROJECT: Project = {
  id: "p1",
  user_id: "u",
  goal_id: null,
  title: "Science Research Project",
  description:
    "Independent research project for Biology — experiment, poster and written report.",
  category: "School",
  deadline: d(26),
  status: "active",
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

export const PROJECT_TASKS: Task[] = [
  task("t1", "Research background reading", "School", 45, "high", null, {
    status: "completed",
    completed_at: m(-2000),
  }),
  task("t2", "Pick a research question", "School", 30, "high", null, {
    status: "completed",
    completed_at: m(-1400),
  }),
  design,
  collect,
  task("t5", "Analyse the data", "School", 60, "medium", null),
  task("t6", "Build the poster", "School", 90, "medium", m(600 * 60)),
];

function milestone(
  id: string,
  goalId: string,
  title: string,
  completed: boolean,
  position: number,
): GoalMilestone {
  return {
    id,
    goal_id: goalId,
    user_id: "u",
    title,
    due_date: null,
    completed,
    position,
    created_at: NOW.toISOString(),
  };
}

const goalBase = (
  id: string,
  title: string,
  description: string,
  deadline: string | null,
): Goal => ({
  id,
  user_id: "u",
  title,
  description,
  deadline,
  status: "active",
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
});

export const GOALS = [
  {
    ...goalBase(
      "g1",
      "Improve my grades this term",
      "Get ahead of assignments instead of finishing them the night before.",
      d(75),
    ),
    milestones: [
      milestone("m1", "g1", "No late assignments for two weeks", true, 0),
      milestone("m2", "g1", "Study for each test more than one day out", false, 1),
    ],
    taskIds: ["a", "m"],
    progress: 33,
  },
  {
    ...goalBase(
      "g2",
      "Practice piano consistently",
      "Thirty minutes, four days a week.",
      null,
    ),
    milestones: [
      milestone("m3", "g2", "Two full weeks in a row", true, 0),
      milestone("m4", "g2", "Learn the second movement", false, 1),
    ],
    taskIds: ["p"],
    progress: 50,
  },
];

export const PROFILE: Profile = {
  id: "u",
  full_name: "Alex Rivera",
  timezone: TZ,
  wake_time: "07:00:00",
  bed_time: "22:30:00",
  school_label: "Lincoln High",
  areas: ["School", "Sports", "Music", "Coding"],
  onboarded: true,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

export const PREFERENCES: UserPreferences = {
  user_id: "u",
  focus_session_minutes: 45,
  break_minutes: 10,
  energy_peak: "evening",
  free_windows: [{ days: [1, 2, 3, 4, 5], start: "16:00", end: "21:00" }],
  estimate_multiplier: 1.15,
  notifications: {
    enabled: true,
    sessionStart: true,
    dailyPlanReminder: true,
    deadlineWarnings: true,
    quietHours: { start: "22:00", end: "07:00" },
  },
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

export const DAILY: DailyReview = {
  id: "dr",
  user_id: "u",
  local_date: todayKey,
  completed_count: 3,
  postponed_count: 1,
  planned_minutes: 195,
  actual_minutes: 145,
  reflection: "Math took way longer than I thought.",
  ai_summary:
    "Three tasks done and most of the evening used. The math study session ran 20 minutes over, so tomorrow's block for it is worth widening. APHUG notes are the one thing left that's due tomorrow.",
  created_at: NOW.toISOString(),
};

export const WEEKLY: WeeklyReview = {
  id: "wr",
  user_id: "u",
  week_start: d(-3),
  stats: {
    completed: 14,
    planned: 17,
    completionRate: 82,
    plannedMinutes: 760,
    actualMinutes: 690,
    mostPostponed: [
      { title: "Biology reading — Chapter 7", count: 3 },
      { title: "Basketball conditioning workout", count: 2 },
    ],
    upcomingDeadlines: [
      { title: "AP Human Geography — Chapter 3 notes", deadline: d(1) },
      { title: "English essay outline", deadline: d(3) },
      { title: "Friday math test", deadline: d(2) },
    ],
    projectProgress: [
      { title: "Science Research Project", progress: 33 },
      { title: "Personal App", progress: 20 },
    ],
  },
  ai_summary:
    "You completed 82% of your planned sessions this week. Your biggest priority next week is the Science Research Project — its deadline is now under four weeks and the experiment isn't designed yet. You also have three deadlines clustered on Thursday and Friday, so Wednesday evening is worth protecting.",
  created_at: NOW.toISOString(),
};
