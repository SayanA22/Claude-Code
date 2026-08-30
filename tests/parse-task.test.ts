import { describe, expect, it } from "vitest";
import { fallbackParseTasks } from "@/lib/ai/fallback-parse";
import { parseTaskResponseSchema } from "@/lib/validation/task";
import { resolveRelativeDeadline } from "@/lib/utils/deadline";

// Wednesday 5 March 2025, 16:00 New York.
const NOW = new Date("2025-03-05T21:00:00Z");
const WEDNESDAY = 3;

const parse = (text: string) => fallbackParseTasks(text, NOW, WEDNESDAY);

describe("fallbackParseTasks", () => {
  it("extracts a title, day and duration from one sentence", () => {
    const [task] = parse("Finish my APHUG notes tomorrow for 45 minutes");
    expect(task.title).toMatch(/APHUG notes/i);
    expect(task.deadline_days_from_today).toBe(1);
    expect(task.estimated_duration).toBe(45);
    expect(task.category).toBe("School");
  });

  it("splits a brain dump into separate tasks", () => {
    const tasks = parse(
      "Need to finish math worksheet, practice piano, workout, and work on my app tomorrow",
    );
    expect(tasks).toHaveLength(4);
    expect(tasks.map((t) => t.title.toLowerCase()).join(" ")).toMatch(/piano/);
  });

  it("assigns categories from what the work is", () => {
    const tasks = parse("piano practice, basketball drills, leetcode problems");
    expect(tasks.map((t) => t.category)).toEqual(["Music", "Sports", "Coding"]);
  });

  it("never invents a deadline the user didn't state", () => {
    const [task] = parse("Practice piano");
    expect(task.deadline_days_from_today).toBeNull();
    expect(task.deadline_time).toBeNull();
  });

  it("reads hours as well as minutes", () => {
    expect(parse("study for 2 hours")[0].estimated_duration).toBe(120);
    expect(parse("read for 1 hr 30 min")[0].estimated_duration).toBe(90);
    expect(parse("workout for half an hour")[0].estimated_duration).toBe(30);
  });

  it("resolves a named weekday to its next occurrence", () => {
    // Said on a Wednesday, "Friday" means two days out.
    expect(parse("Math test Friday")[0].deadline_days_from_today).toBe(2);
    // The same weekday means next week, not today.
    expect(parse("essay due Wednesday")[0].deadline_days_from_today).toBe(7);
  });

  it("reads a clock time and assumes evening for a bare hour", () => {
    expect(parse("piano at 6")[0].deadline_time).toBe("18:00");
    expect(parse("call at 9am")[0].deadline_time).toBe("09:00");
    expect(parse("study at 7:30pm")[0].deadline_time).toBe("19:30");
  });

  it("picks up priority language", () => {
    expect(parse("urgent: submit the form")[0].priority).toBe("critical");
    expect(parse("read a chapter whenever")[0].priority).toBe("low");
    expect(parse("write notes")[0].priority).toBe("medium");
  });

  it("strips filler from the title", () => {
    const [task] = parse("I need to finish my history essay");
    expect(task.title.toLowerCase()).not.toMatch(/need to/);
    expect(task.title.toLowerCase()).toContain("history essay");
  });

  it("returns nothing for empty input", () => {
    expect(parse("   ")).toEqual([]);
  });

  it("produces output the validation schema accepts", () => {
    const tasks = parse(
      "Finish math worksheet tomorrow for 30 minutes, practice piano, workout",
    );
    const result = parseTaskResponseSchema.safeParse({
      tasks,
      clarification: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("deadline resolution", () => {
  it("turns a relative day into end of that day in the user's zone", () => {
    const iso = resolveRelativeDeadline(
      { deadline_days_from_today: 1, deadline_time: null },
      "2025-03-05",
      "America/New_York",
    );
    // 23:59 on 6 March in New York is 04:59Z on 7 March.
    expect(iso).toBe("2025-03-07T04:59:00.000Z");
  });

  it("uses a stated time when the user gave one", () => {
    const iso = resolveRelativeDeadline(
      { deadline_days_from_today: 0, deadline_time: "18:00" },
      "2025-03-05",
      "America/New_York",
    );
    expect(iso).toBe("2025-03-05T23:00:00.000Z");
  });

  it("returns null when no day was stated", () => {
    expect(
      resolveRelativeDeadline(
        { deadline_days_from_today: null, deadline_time: null },
        "2025-03-05",
        "UTC",
      ),
    ).toBeNull();
  });
});
