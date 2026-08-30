"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CategoryDot } from "@/components/tasks/task-meta";
import { startBlock } from "@/app/actions/schedule";
import { formatDuration, formatRange } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { ScheduleBlockWithTask } from "@/types/db";

/**
 * The single most important surface in DayOS: one thing, one time, one button.
 */
export function UpNextCard({
  block,
  timeZone,
  isNow,
  isLate,
  onCantDoThis,
}: {
  block: ScheduleBlockWithTask;
  timeZone: string;
  isNow: boolean;
  isLate: boolean;
  onCantDoThis: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  const start = new Date(block.start_at);
  const end = new Date(block.end_at);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);

  async function begin() {
    setPending(true);
    const result = await startBlock(block.id);
    if (!result.ok) {
      setPending(false);
      toast(result.error, "error");
      return;
    }
    router.push(`/focus/${block.id}`);
  }

  return (
    <section
      aria-labelledby="up-next-heading"
      className={cn(
        "animate-rise rounded-2xl border bg-surface p-5 shadow-[0_1px_3px_rgba(16,18,32,0.05)]",
        isLate ? "border-warning/50" : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <h2
          id="up-next-heading"
          className="text-[11px] font-semibold tracking-wider text-faint uppercase"
        >
          {isLate ? "Running late" : isNow ? "Right now" : "Up next"}
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <CategoryDot category={block.task?.category ?? "Other"} />
          {block.task?.category ?? "Focus"}
        </span>
      </div>

      <p className="mt-3 text-[22px] leading-tight font-semibold tracking-tight">
        {block.title}
      </p>
      {block.task?.description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {block.task.description}
        </p>
      ) : null}

      <p className="tnum mt-3 text-[15px] text-muted">
        {formatRange(start, end, timeZone)}
        <span className="text-faint"> · {formatDuration(minutes)}</span>
      </p>

      {block.reason ? (
        <p className="mt-1 text-xs text-faint">{block.reason}</p>
      ) : null}

      <div className="mt-5 flex items-center gap-2">
        <Button size="lg" className="flex-1" onClick={begin} loading={pending}>
          <Play className="h-4 w-4 fill-current" aria-hidden />
          Start
        </Button>
        <Button size="lg" variant="secondary" onClick={onCantDoThis}>
          Can&apos;t right now
        </Button>
      </div>
    </section>
  );
}
