import { Clock, Flag, Folder } from "lucide-react";
import { PriorityBadge } from "@/components/ui/badge";
import { categoryColor } from "@/lib/utils/category";
import { formatDuration, formatRelativeDay } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/db";

export function CategoryDot({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: categoryColor(category) }}
    />
  );
}

/** The compact meta line under a task title. */
export function TaskMeta({
  task,
  todayKey,
  timeZone,
  nowMs,
  className,
}: {
  task: Task;
  todayKey: string;
  timeZone: string;
  /** Passed in rather than read from the clock, so rendering stays pure. */
  nowMs: number;
  className?: string;
}) {
  const deadlineKey = task.deadline
    ? deadlineDayKey(task.deadline, timeZone)
    : null;
  const overdue =
    task.deadline && new Date(task.deadline).getTime() < nowMs;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <CategoryDot category={task.category} />
        {task.category}
      </span>

      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" aria-hidden />
        {formatDuration(task.estimated_duration)}
      </span>

      {deadlineKey ? (
        <span
          className={cn(
            "inline-flex items-center gap-1",
            overdue && "font-medium text-danger",
          )}
        >
          <Flag className="h-3 w-3" aria-hidden />
          {overdue ? "Overdue · " : "Due "}
          {formatRelativeDay(deadlineKey, todayKey)}
        </span>
      ) : null}

      {task.project_id ? (
        <span className="inline-flex items-center gap-1">
          <Folder className="h-3 w-3" aria-hidden />
          Project
        </span>
      ) : null}

      <PriorityBadge priority={task.priority} className="px-0" />
    </div>
  );
}

function deadlineDayKey(deadline: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(deadline));
}
