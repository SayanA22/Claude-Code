import type { TaskPriority } from "@/types/db";

/**
 * Demo data — a believable week for a high-school student.
 *
 * Kept out of the app's normal paths: it is only ever written by an explicit
 * user action, behind `NEXT_PUBLIC_ENABLE_DEMO_MODE`. Nothing here is
 * referenced by production behaviour.
 */

export interface DemoTask {
  title: string;
  description?: string;
  category: string;
  priority: TaskPriority;
  estimated_duration: number;
  /** Days from today; null for undated. */
  dueInDays: number | null;
  dueTime?: string;
  project?: string;
  postpone_count?: number;
}

export interface DemoProject {
  key: string;
  title: string;
  description: string;
  category: string;
  dueInDays: number;
}

export interface DemoGoal {
  title: string;
  description: string;
  dueInDays: number | null;
  milestones: string[];
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    key: "science",
    title: "Science Research Project",
    description:
      "Independent research project for Biology — experiment, poster and written report.",
    category: "School",
    dueInDays: 26,
  },
  {
    key: "app",
    title: "Personal App",
    description:
      "A habit tracker I'm building to learn React properly. No deadline, just steady progress.",
    category: "Coding",
    dueInDays: 60,
  },
];

export const DEMO_GOALS: DemoGoal[] = [
  {
    title: "Improve my grades this term",
    description: "Get ahead of assignments instead of finishing them the night before.",
    dueInDays: 75,
    milestones: [
      "No late assignments for two weeks",
      "Study for each test more than one day out",
    ],
  },
  {
    title: "Practice piano consistently",
    description: "Thirty minutes, four days a week.",
    dueInDays: null,
    milestones: ["Two full weeks in a row", "Learn the second movement"],
  },
];

export const DEMO_TASKS: DemoTask[] = [
  {
    title: "AP Human Geography — Chapter 3 notes",
    description: "Cornell notes on urbanisation, due at the start of class.",
    category: "School",
    priority: "high",
    estimated_duration: 45,
    dueInDays: 1,
    dueTime: "08:30",
  },
  {
    title: "Study for Friday math test",
    description: "Sections 4.1–4.6, focus on the word problems.",
    category: "School",
    priority: "critical",
    estimated_duration: 60,
    dueInDays: 3,
  },
  {
    title: "Piano practice",
    category: "Music",
    priority: "medium",
    estimated_duration: 30,
    dueInDays: null,
  },
  {
    title: "Basketball conditioning workout",
    category: "Fitness",
    priority: "medium",
    estimated_duration: 45,
    dueInDays: null,
  },
  {
    title: "Work on habit tracker UI",
    category: "Coding",
    priority: "medium",
    estimated_duration: 60,
    dueInDays: null,
    project: "app",
  },
  {
    title: "Biology reading — Chapter 7",
    category: "School",
    priority: "medium",
    estimated_duration: 40,
    dueInDays: 2,
    postpone_count: 2,
  },
  {
    title: "Design the experiment",
    description: "Variables, control, and what I'm actually measuring.",
    category: "School",
    priority: "high",
    estimated_duration: 60,
    dueInDays: 5,
    project: "science",
  },
  {
    title: "Collect week 1 data",
    category: "School",
    priority: "medium",
    estimated_duration: 45,
    dueInDays: 12,
    project: "science",
  },
  {
    title: "English essay outline",
    category: "School",
    priority: "high",
    estimated_duration: 35,
    dueInDays: 4,
  },
];

export interface DemoFixedEvent {
  title: string;
  category: string;
  days: number[];
  start: string;
  end: string;
}

export const DEMO_FIXED_EVENTS: DemoFixedEvent[] = [
  {
    title: "School",
    category: "School",
    days: [1, 2, 3, 4, 5],
    start: "08:00",
    end: "15:20",
  },
  {
    title: "Basketball practice",
    category: "Sports",
    days: [2, 4],
    start: "16:00",
    end: "17:45",
  },
];
