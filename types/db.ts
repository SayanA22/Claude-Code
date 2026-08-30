/**
 * Hand-maintained mirror of `supabase/migrations/*.sql`.
 *
 * Kept hand-written rather than generated so the app has a single source of
 * truth for row shapes without requiring the Supabase CLI at build time.
 */

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "completed"
  | "skipped"
  | "archived";
export type BlockKind = "task" | "break" | "fixed" | "buffer";
export type BlockStatus = "planned" | "in_progress" | "completed" | "skipped";
export type ProjectStatus = "active" | "completed" | "archived";
export type GoalStatus = "active" | "completed" | "archived";
export type EnergyPeak = "morning" | "afternoon" | "evening";
export type Recurrence = "daily" | "weekdays" | "weekly" | null;

export const TASK_PRIORITIES: TaskPriority[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export const CATEGORIES = [
  "School",
  "Sports",
  "Fitness",
  "Music",
  "Coding",
  "Projects",
  "Personal",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Profile {
  id: string;
  full_name: string | null;
  timezone: string;
  wake_time: string; // "07:00:00"
  bed_time: string;
  school_label: string | null;
  areas: string[];
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface FreeWindow {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  start: string; // "16:00"
  end: string; // "21:00"
}

export interface NotificationPrefs {
  enabled: boolean;
  sessionStart: boolean;
  dailyPlanReminder: boolean;
  deadlineWarnings: boolean;
  quietHours: { start: string; end: string };
}

export interface UserPreferences {
  user_id: string;
  focus_session_minutes: number;
  break_minutes: number;
  energy_peak: EnergyPeak;
  free_windows: FreeWindow[];
  estimate_multiplier: number;
  notifications: NotificationPrefs;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  category: string;
  deadline: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: TaskPriority;
  deadline: string | null;
  estimated_duration: number;
  actual_duration: number | null;
  recurring: Recurrence;
  status: TaskStatus;
  notes: string | null;
  postpone_count: number;
  depends_on: string[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedEvent {
  id: string;
  user_id: string;
  title: string;
  category: string;
  start_at: string | null;
  end_at: string | null;
  recurring_days: number[];
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

export interface ScheduleBlock {
  id: string;
  user_id: string;
  task_id: string | null;
  title: string;
  kind: BlockKind;
  status: BlockStatus;
  start_at: string;
  end_at: string;
  local_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReview {
  id: string;
  user_id: string;
  local_date: string;
  completed_count: number;
  postponed_count: number;
  planned_minutes: number;
  actual_minutes: number;
  reflection: string | null;
  ai_summary: string | null;
  created_at: string;
}

export interface WeeklyReviewStats {
  completed: number;
  planned: number;
  completionRate: number;
  plannedMinutes: number;
  actualMinutes: number;
  mostPostponed: { title: string; count: number }[];
  upcomingDeadlines: { title: string; deadline: string }[];
  projectProgress: { title: string; progress: number }[];
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  stats: WeeklyReviewStats;
  ai_summary: string | null;
  created_at: string;
}

/** A schedule block joined with the task it points at. */
export type ScheduleBlockWithTask = ScheduleBlock & { task: Task | null };
