"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { CATEGORIES, TASK_PRIORITIES, type Task } from "@/types/db";
import { addDaysToKey, fromLocalParts } from "@/lib/utils/time";
import {
  createTask,
  deleteTask,
  updateTask,
} from "@/app/actions/tasks";

export interface TaskDraft {
  title: string;
  description: string;
  category: string;
  priority: string;
  /** "YYYY-MM-DD" or "" */
  deadlineDate: string;
  /** "HH:MM" or "" */
  deadlineTime: string;
  estimated_duration: number;
  recurring: string;
  notes: string;
  project_id: string | null;
}

export function draftFromTask(task: Task, timeZone: string): TaskDraft {
  const parts = task.deadline
    ? localParts(new Date(task.deadline), timeZone)
    : null;
  return {
    title: task.title,
    description: task.description ?? "",
    category: task.category,
    priority: task.priority,
    deadlineDate: parts?.date ?? "",
    deadlineTime: parts?.time ?? "",
    estimated_duration: task.estimated_duration,
    recurring: task.recurring ?? "",
    notes: task.notes ?? "",
    project_id: task.project_id,
  };
}

export function emptyDraft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: "",
    description: "",
    category: "School",
    priority: "medium",
    deadlineDate: "",
    deadlineTime: "",
    estimated_duration: 30,
    recurring: "",
    notes: "",
    project_id: null,
    ...overrides,
  };
}

function localParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * Turns the date + time fields into an instant in the user's zone.
 *
 * A date with no time means "end of that day" — which is what a student means
 * by "due Friday".
 */
export function deadlineToIso(
  date: string,
  time: string,
  timeZone: string,
): string | null {
  if (!date) return null;
  return fromLocalParts(date, time || "23:59", timeZone).toISOString();
}

export function TaskForm({
  task,
  timeZone,
  todayKey,
  initial,
  projectId,
  onDone,
}: {
  task?: Task;
  timeZone: string;
  todayKey: string;
  initial?: Partial<TaskDraft>;
  projectId?: string | null;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = React.useState<TaskDraft>(() =>
    task ? draftFromTask(task, timeZone) : emptyDraft(initial),
  );
  const [pending, setPending] = React.useState(false);

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setPending(true);

    const payload = {
      title: draft.title,
      description: draft.description,
      category: draft.category,
      priority: draft.priority,
      deadline: deadlineToIso(draft.deadlineDate, draft.deadlineTime, timeZone),
      estimated_duration: Number(draft.estimated_duration) || 30,
      recurring: draft.recurring,
      notes: draft.notes,
      project_id: projectId ?? draft.project_id,
    };

    const result = task
      ? await updateTask({ id: task.id, ...payload })
      : await createTask(payload);

    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(task ? "Task updated" : "Task added", "success");
    onDone();
  }

  async function remove() {
    if (!task) return;
    setPending(true);
    const result = await deleteTask(task.id);
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Task deleted");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="What needs doing?" htmlFor="title">
        <Input
          id="title"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Chapter 3 notes"
          autoFocus={!task}
          required
          maxLength={300}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="category">
          <Select
            id="category"
            value={draft.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priority" htmlFor="priority">
          <Select
            id="priority"
            value={draft.priority}
            onChange={(e) => set("priority", e.target.value)}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date" htmlFor="deadlineDate">
          <Input
            id="deadlineDate"
            type="date"
            value={draft.deadlineDate}
            min={addDaysToKey(todayKey, -365)}
            onChange={(e) => set("deadlineDate", e.target.value)}
          />
        </Field>
        <Field label="Due time" htmlFor="deadlineTime" hint="Defaults to end of day.">
          <Input
            id="deadlineTime"
            type="time"
            value={draft.deadlineTime}
            onChange={(e) => set("deadlineTime", e.target.value)}
            disabled={!draft.deadlineDate}
          />
        </Field>
      </div>

      <Field
        label="How long will it take?"
        htmlFor="estimated_duration"
        hint="Minutes. DayOS uses this to find a slot that fits."
      >
        <div className="flex items-center gap-2">
          <Input
            id="estimated_duration"
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            step={5}
            value={draft.estimated_duration}
            onChange={(e) => set("estimated_duration", Number(e.target.value))}
            className="w-28"
          />
          <div className="flex gap-1.5">
            {[15, 30, 45, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("estimated_duration", m)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </Field>

      <Field
        label="Repeats"
        htmlFor="recurring"
        hint="A new instance appears each time you finish this one."
      >
        <Select
          id="recurring"
          value={draft.recurring}
          onChange={(e) => set("recurring", e.target.value)}
        >
          <option value="">Doesn&apos;t repeat</option>
          <option value="daily">Every day</option>
          <option value="weekdays">Every weekday</option>
          <option value="weekly">Every week</option>
        </Select>
      </Field>

      <Field label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Anything you'll want in front of you when you start."
          maxLength={2000}
        />
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" className="flex-1" loading={pending}>
          {task ? "Save changes" : "Add task"}
        </Button>
        {task ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={remove}
            aria-label="Delete task"
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </form>
  );
}
