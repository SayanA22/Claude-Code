import { describe, expect, it } from "vitest";
import {
  DAILY_CAP,
  computeNotifications,
  isQuiet,
} from "@/lib/notifications/schedule";
import type { NotificationPrefs, ScheduleBlockWithTask, Task } from "@/types/db";

const TZ = "America/New_York";
const H = 3_600_000;
// 14:00 in New York, so an evening check-in is still ahead.
const NOW = new Date("2025-03-05T19:00:00Z");

const prefs = (overrides: Partial<NotificationPrefs> = {}): NotificationPrefs => ({
  enabled: true,
  sessionStart: true,
  dailyPlanReminder: true,
  deadlineWarnings: true,
  quietHours: { start: "22:00", end: "07:00" },
  ...overrides,
});

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    user_id: "u1",
    project_id: null,
    title: "APHUG notes",
    description: null,
    category: "School",
    priority: "high",
    deadline: null,
    estimated_duration: 45,
    actual_duration: null,
    recurring: null,
    status: "todo",
    notes: null,
    postpone_count: 0,
    depends_on: [],
    completed_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function block(overrides: Partial<ScheduleBlockWithTask> = {}): ScheduleBlockWithTask {
  return {
    id: overrides.id ?? "b1",
    user_id: "u1",
    task_id: "t1",
    title: "APHUG notes",
    kind: "task",
    status: "planned",
    start_at: new Date(NOW.getTime() + 2 * H).toISOString(),
    end_at: new Date(NOW.getTime() + 3 * H).toISOString(),
    local_date: "2025-03-05",
    reason: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    task: task(),
    ...overrides,
  };
}

const run = (args: Partial<Parameters<typeof computeNotifications>[0]> = {}) =>
  computeNotifications({
    blocks: [],
    tasks: [],
    prefs: prefs(),
    now: NOW,
    timeZone: TZ,
    ...args,
  });

describe("computeNotifications", () => {
  it("sends nothing when notifications are off", () => {
    expect(run({ blocks: [block()], prefs: prefs({ enabled: false }) })).toEqual([]);
  });

  it("warns ten minutes before a session", () => {
    const upcoming = block();
    const [notification] = run({ blocks: [upcoming] });
    expect(notification.kind).toBe("session_start");
    expect(new Date(upcoming.start_at).getTime() - notification.at.getTime()).toBe(
      10 * 60_000,
    );
    expect(notification.href).toBe(`/focus/${upcoming.id}`);
  });

  it("skips sessions already started, completed or skipped", () => {
    const past = block({ id: "past", start_at: new Date(NOW.getTime() - H).toISOString() });
    const done = block({ id: "done", status: "completed" });
    const skipped = block({ id: "skip", status: "skipped" });
    const results = run({ blocks: [past, done, skipped] });
    expect(results.filter((n) => n.kind === "session_start")).toEqual([]);
  });

  it("never notifies for breaks", () => {
    const brk = block({ id: "brk", kind: "break", title: "Break" });
    expect(run({ blocks: [brk] }).filter((n) => n.kind === "session_start")).toEqual([]);
  });

  it("sends one deadline warning, a day out", () => {
    const due = task({ deadline: new Date(NOW.getTime() + 30 * H).toISOString() });
    const warnings = run({ tasks: [due] }).filter(
      (n) => n.kind === "deadline_warning",
    );
    expect(warnings).toHaveLength(1);
    expect(new Date(due.deadline as string).getTime() - warnings[0].at.getTime()).toBe(
      24 * H,
    );
  });

  it("doesn't warn about a deadline less than a day away", () => {
    const due = task({ deadline: new Date(NOW.getTime() + 3 * H).toISOString() });
    expect(run({ tasks: [due] }).filter((n) => n.kind === "deadline_warning")).toEqual([]);
  });

  it("only checks in when important work is still open", () => {
    const blocks = [block({ id: "b1" }), block({ id: "b2" })];
    const withImportant = run({ blocks, tasks: [task({ priority: "high" })] });
    const withoutImportant = run({ blocks, tasks: [task({ priority: "low" })] });

    expect(withImportant.some((n) => n.kind === "day_remaining")).toBe(true);
    expect(withoutImportant.some((n) => n.kind === "day_remaining")).toBe(false);
  });

  it("suppresses anything that would land in quiet hours", () => {
    // A session at 01:00 local would notify at 00:50 — inside quiet hours.
    const lateNight = block({
      start_at: new Date("2025-03-06T06:00:00Z").toISOString(),
      end_at: new Date("2025-03-06T07:00:00Z").toISOString(),
    });
    expect(run({ blocks: [lateNight] })).toEqual([]);
  });

  it("caps how many notifications a day can produce", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      block({
        id: `b${i}`,
        start_at: new Date(NOW.getTime() + (i + 2) * 15 * 60_000).toISOString(),
        end_at: new Date(NOW.getTime() + (i + 3) * 15 * 60_000).toISOString(),
      }),
    );
    expect(run({ blocks: many }).length).toBeLessThanOrEqual(DAILY_CAP);
  });

  it("returns notifications in chronological order", () => {
    const blocks = [
      block({ id: "late", start_at: new Date(NOW.getTime() + 4 * H).toISOString(), end_at: new Date(NOW.getTime() + 5 * H).toISOString() }),
      block({ id: "soon" }),
    ];
    const times = run({ blocks }).map((n) => n.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("gives each notification a stable id, so it can't be sent twice", () => {
    const blocks = [block()];
    expect(run({ blocks })[0].id).toBe(run({ blocks })[0].id);
  });
});

describe("isQuiet", () => {
  const p = prefs();

  it("covers a window that wraps midnight", () => {
    expect(isQuiet(new Date("2025-03-06T04:00:00Z"), p, TZ)).toBe(true); // 23:00
    expect(isQuiet(new Date("2025-03-06T10:00:00Z"), p, TZ)).toBe(true); // 05:00
    expect(isQuiet(new Date("2025-03-05T19:00:00Z"), p, TZ)).toBe(false); // 14:00
  });

  it("covers a same-day window", () => {
    const daytime = prefs({ quietHours: { start: "09:00", end: "15:00" } });
    expect(isQuiet(new Date("2025-03-05T17:00:00Z"), daytime, TZ)).toBe(true); // 12:00
    expect(isQuiet(new Date("2025-03-05T21:00:00Z"), daytime, TZ)).toBe(false); // 16:00
  });
});
