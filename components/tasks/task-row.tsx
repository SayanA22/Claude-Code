"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/db";
import { TaskMeta } from "./task-meta";

/**
 * One task in a list.
 *
 * Completion is optimistic: the row settles immediately and reverts if the
 * server rejects it, so ticking things off never feels like waiting.
 */
export function TaskRow({
  task,
  todayKey,
  timeZone,
  nowMs,
  onToggle,
  onOpen,
}: {
  task: Task;
  todayKey: string;
  timeZone: string;
  nowMs: number;
  onToggle: (task: Task, complete: boolean) => void;
  onOpen: (task: Task) => void;
}) {
  const done = task.status === "completed";

  return (
    <li
      className={cn(
        "group flex items-start gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3 transition-colors",
        done && "opacity-60",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        onClick={() => onToggle(task, !done)}
        className={cn(
          "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-all",
          done
            ? "border-success bg-success text-white"
            : "border-border-strong hover:border-accent",
        )}
      >
        <Check
          className={cn(
            "h-3 w-3 transition-transform",
            done ? "scale-100" : "scale-0",
          )}
          strokeWidth={3.5}
          aria-hidden
        />
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={cn(
            "text-[0.9375rem] leading-snug font-medium",
            done && "line-through decoration-muted",
          )}
        >
          {task.title}
        </p>
        <TaskMeta
          task={task}
          todayKey={todayKey}
          timeZone={timeZone}
          nowMs={nowMs}
          className="mt-1.5"
        />
      </button>
    </li>
  );
}
