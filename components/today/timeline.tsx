"use client";

import { Check, MoreHorizontal, SkipForward } from "lucide-react";
import { CategoryDot } from "@/components/tasks/task-meta";
import { formatClock, formatDuration } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { ScheduleBlockWithTask } from "@/types/db";

/**
 * The day as a vertical timeline. Every row shows time, task, category,
 * duration and state, so the whole day reads in one scroll.
 */
export function Timeline({
  blocks,
  timeZone,
  now,
  onAction,
}: {
  blocks: ScheduleBlockWithTask[];
  timeZone: string;
  now: Date;
  onAction: (block: ScheduleBlockWithTask) => void;
}) {
  return (
    <ol className="relative space-y-1">
      {blocks.map((block) => {
        const start = new Date(block.start_at);
        const end = new Date(block.end_at);
        const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
        const done = block.status === "completed";
        const skipped = block.status === "skipped";
        const running =
          block.status === "in_progress" ||
          (start <= now && end > now && !done && !skipped);
        const missed =
          end <= now && (block.status === "planned" || block.status === "in_progress");
        const isBreak = block.kind === "break";

        return (
          <li
            key={block.id}
            className={cn(
              "flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors",
              running && "bg-accent-soft",
              (done || skipped) && "opacity-55",
            )}
          >
            <div className="tnum w-[68px] shrink-0 pt-0.5 text-right text-[13px] text-muted">
              {formatClock(start, timeZone)}
            </div>

            <div
              aria-hidden
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                done
                  ? "bg-success"
                  : skipped
                    ? "bg-faint"
                    : missed
                      ? "bg-warning"
                      : running
                        ? "bg-accent"
                        : "bg-border-strong",
              )}
            />

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[15px] leading-snug",
                  isBreak ? "text-muted" : "font-medium",
                  done && "line-through decoration-muted",
                )}
              >
                {block.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                {block.task ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CategoryDot category={block.task.category} />
                    {block.task.category}
                  </span>
                ) : null}
                <span>{formatDuration(minutes)}</span>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Check className="h-3 w-3" aria-hidden />
                    Done
                  </span>
                ) : skipped ? (
                  <span className="inline-flex items-center gap-1">
                    <SkipForward className="h-3 w-3" aria-hidden />
                    Skipped
                  </span>
                ) : missed ? (
                  <span className="font-medium text-warning">Missed</span>
                ) : running ? (
                  <span className="font-medium text-accent">In progress</span>
                ) : null}
              </p>
            </div>

            {!isBreak && !done && !skipped ? (
              <button
                type="button"
                onClick={() => onAction(block)}
                aria-label={`Options for ${block.title}`}
                className="-mr-1 rounded-lg p-2 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
