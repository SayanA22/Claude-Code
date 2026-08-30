import { describe, expect, it } from "vitest";
import {
  MAX_MULTIPLIER,
  MIN_MULTIPLIER,
  calibrate,
  nextMultiplier,
  samplesFromTasks,
} from "@/lib/planner/estimates";
import type { Task } from "@/types/db";

describe("nextMultiplier", () => {
  it("holds steady until there is enough evidence", () => {
    expect(nextMultiplier(1, [{ estimated: 30, actual: 60 }])).toBe(1);
    expect(
      nextMultiplier(1, [
        { estimated: 30, actual: 60 },
        { estimated: 30, actual: 60 },
      ]),
    ).toBe(1);
  });

  it("moves toward the observed ratio, not straight to it", () => {
    // Consistently taking double the estimate: the model should move up, but
    // only part of the way — one bad week shouldn't reshape the schedule.
    const samples = Array.from({ length: 5 }, () => ({
      estimated: 30,
      actual: 60,
    }));
    const next = nextMultiplier(1, samples);
    expect(next).toBeGreaterThan(1);
    expect(next).toBeLessThan(2);
  });

  it("converges upward over repeated reviews", () => {
    const samples = Array.from({ length: 5 }, () => ({
      estimated: 30,
      actual: 60,
    }));
    let value = 1;
    for (let i = 0; i < 10; i++) value = nextMultiplier(value, samples);
    expect(value).toBeGreaterThan(1.8);
    expect(value).toBeLessThanOrEqual(2.01);
  });

  it("moves down when work finishes faster than estimated", () => {
    const samples = Array.from({ length: 4 }, () => ({
      estimated: 60,
      actual: 30,
    }));
    expect(nextMultiplier(1, samples)).toBeLessThan(1);
  });

  it("stays within bounds", () => {
    const extreme = Array.from({ length: 5 }, () => ({
      estimated: 5,
      actual: 600,
    }));
    let value = 1;
    for (let i = 0; i < 50; i++) value = nextMultiplier(value, extreme);
    expect(value).toBeLessThanOrEqual(MAX_MULTIPLIER);
    expect(value).toBeGreaterThanOrEqual(MIN_MULTIPLIER);
  });

  it("ignores malformed samples", () => {
    expect(
      nextMultiplier(1, [
        { estimated: 0, actual: 30 },
        { estimated: 30, actual: 0 },
        { estimated: 30, actual: 30 },
      ]),
    ).toBe(1);
  });
});

describe("samplesFromTasks", () => {
  it("only uses completed tasks with both numbers recorded", () => {
    const tasks = [
      { status: "completed", estimated_duration: 30, actual_duration: 45 },
      { status: "completed", estimated_duration: 30, actual_duration: null },
      { status: "todo", estimated_duration: 30, actual_duration: 45 },
    ] as Pick<Task, "estimated_duration" | "actual_duration" | "status">[];

    expect(samplesFromTasks(tasks)).toEqual([{ estimated: 30, actual: 45 }]);
  });
});

describe("calibrate", () => {
  it("scales and rounds to a tidy five minutes", () => {
    expect(calibrate(30, 1.5)).toBe(45);
    expect(calibrate(30, 1.1)).toBe(35);
    expect(calibrate(30, 1)).toBe(30);
  });

  it("never returns less than a usable session", () => {
    expect(calibrate(5, 0.5)).toBe(5);
  });
});
