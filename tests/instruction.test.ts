import { describe, expect, it } from "vitest";
import { parseTimeBudget } from "@/lib/planner/instruction";
import { generateSchedule, type PlannableTask } from "@/lib/planner/generate";
import { fromLocalParts } from "@/lib/utils/time";
import { greetingFor } from "@/lib/utils/time";

describe("parseTimeBudget", () => {
  it("reads the phrasing students actually use", () => {
    expect(parseTimeBudget("I only have 30 minutes now")).toBe(30);
    expect(parseTimeBudget("only got 45 mins")).toBe(45);
    expect(parseTimeBudget("I have about 20m before practice")).toBe(20);
    expect(parseTimeBudget("half an hour")).toBe(30);
    expect(parseTimeBudget("I've got an hour")).toBe(60);
    expect(parseTimeBudget("two hours free")).toBe(120);
    expect(parseTimeBudget("1.5 hours")).toBe(90);
    expect(parseTimeBudget("an hour and a half")).toBe(90);
    expect(parseTimeBudget("2 hours 30 minutes")).toBe(150);
  });

  it("returns null when no duration was stated", () => {
    expect(parseTimeBudget("move my workout to tomorrow")).toBeNull();
    expect(parseTimeBudget("I'm not feeling this right now")).toBeNull();
    expect(parseTimeBudget("")).toBeNull();
  });

  it("clamps implausible values rather than trusting them", () => {
    expect(parseTimeBudget("I have 5000 minutes")).toBe(600);
    expect(parseTimeBudget("I have 1 minute")).toBe(5);
  });
});

describe("first session cap", () => {
  const TZ = "UTC";
  const DATE = "2025-03-05";
  const at = (t: string) => fromLocalParts(DATE, t, TZ).getTime();
  const prefs = {
    focus_session_minutes: 45,
    break_minutes: 10,
    estimate_multiplier: 1,
  };
  const task = (
    id: string,
    minutes: number,
    deadline: string | null = null,
  ): PlannableTask => ({
    id,
    title: `Task ${id}`,
    category: "School",
    priority: "medium",
    deadline,
    estimated_duration: minutes,
    postpone_count: 0,
    status: "todo",
    depends_on: [],
  });

  const free = [{ start: at("16:00"), end: at("21:00") }];
  const now = new Date(at("16:00"));

  it("caps only the first session, leaving the rest of the day alone", () => {
    // The first task is exactly the capped length, so the second session is
    // free to show the user's normal focus length rather than the remainder
    // of a split task.
    // "a" has the nearer deadline, so it is unambiguously first; it is also
    // exactly the capped length, so the second session shows the user's normal
    // focus length rather than the remainder of a split task.
    const plan = generateSchedule({
      tasks: [
        task("a", 30, new Date(at("16:00") + 8 * 3_600_000).toISOString()),
        task("b", 60),
      ],
      free,
      preferences: prefs,
      now,
      firstSessionCapMinutes: 30,
    });

    const sessions = plan.blocks.filter((b) => b.kind === "task");
    expect(sessions.length).toBeGreaterThan(1);
    expect(sessions[0].taskId).toBe("a");
    expect((sessions[0].end - sessions[0].start) / 60_000).toBe(30);
    expect(sessions[1].taskId).toBe("b");
    expect((sessions[1].end - sessions[1].start) / 60_000).toBe(45);
  });

  it("still splits a long task correctly under a cap", () => {
    const plan = generateSchedule({
      tasks: [task("a", 60)],
      free,
      preferences: prefs,
      now,
      firstSessionCapMinutes: 30,
    });
    const sessions = plan.blocks.filter((b) => b.kind === "task");
    const minutes = sessions.map((s) => (s.end - s.start) / 60_000);
    expect(minutes[0]).toBe(30);
    expect(minutes.reduce((a, b) => a + b, 0)).toBe(60);
  });

  it("plans full-length sessions when nothing was said", () => {
    const plan = generateSchedule({
      tasks: [task("a", 60)],
      free,
      preferences: prefs,
      now,
    });
    const first = plan.blocks.find((b) => b.kind === "task");
    expect((first!.end - first!.start) / 60_000).toBe(45);
  });

  it("never shrinks a session below something useful", () => {
    const plan = generateSchedule({
      tasks: [task("a", 60)],
      free,
      preferences: prefs,
      now,
      firstSessionCapMinutes: 5,
    });
    const first = plan.blocks.find((b) => b.kind === "task");
    expect((first!.end - first!.start) / 60_000).toBeGreaterThanOrEqual(15);
  });
});

describe("greetingFor", () => {
  const at = (hour: number) =>
    new Date(Date.UTC(2025, 2, 5, hour, 30));

  it("does not call 2am the morning", () => {
    // The person reading this is up late, not up early.
    expect(greetingFor(at(2), "UTC")).toBe("Good evening");
    expect(greetingFor(at(4), "UTC")).toBe("Good evening");
  });

  it("covers the rest of the day", () => {
    expect(greetingFor(at(8), "UTC")).toBe("Good morning");
    expect(greetingFor(at(14), "UTC")).toBe("Good afternoon");
    expect(greetingFor(at(20), "UTC")).toBe("Good evening");
  });
});
