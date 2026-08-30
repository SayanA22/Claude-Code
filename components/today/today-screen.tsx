"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarX2, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlanDayButton } from "./plan-day-button";
import { BlockActionsSheet } from "./block-actions";
import { Timeline } from "./timeline";
import { UpNextCard } from "./up-next";
import { computeDayState } from "@/lib/planner/now";
import { useNow } from "@/lib/hooks/use-now";
import {
  formatClock,
  formatDuration,
  greetingFor,
} from "@/lib/utils/time";
import { rankTasks } from "@/lib/planner/priority";
import type { ScheduleBlockWithTask, Task } from "@/types/db";
import type { PlanOutcome } from "@/lib/planner/plan-day";

/**
 * The Today screen.
 *
 * Everything above the fold answers one question: what should I be doing right
 * now? The clock re-derives day state every 30 seconds without a round trip,
 * so "up next" is never stale.
 */
export function TodayScreen({
  blocks,
  openTasks,
  timeZone,
  firstName,
  serverNow,
}: {
  blocks: ScheduleBlockWithTask[];
  openTasks: Task[];
  timeZone: string;
  firstName: string;
  serverNow: string;
}) {
  const now = useNow(30_000, Date.parse(serverNow));
  const [actionBlock, setActionBlock] =
    React.useState<ScheduleBlockWithTask | null>(null);
  const [lastPlan, setLastPlan] = React.useState<PlanOutcome | null>(null);

  const state = React.useMemo(
    () => computeDayState(blocks, openTasks, now),
    [blocks, openTasks, now],
  );

  // With nothing scheduled, still answer the question — recommend the
  // highest-value open task rather than showing an empty screen.
  const suggestion = React.useMemo(() => {
    if (state.focusBlock || !openTasks.length) return null;
    return rankTasks(openTasks, { now, allTasks: openTasks })[0] ?? null;
  }, [state.focusBlock, openTasks, now]);

  const isRunningLate = state.status === "behind";

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
          {greetingFor(now, timeZone)}, {firstName}
        </h1>
        <p className="mt-0.5 text-sm text-muted">Here&apos;s what matters today.</p>
      </header>

      <div className="mb-5 flex items-baseline gap-2.5">
        <span className="tnum text-[15px] font-medium">
          {formatClock(now, timeZone)}
        </span>
        <span
          className={
            isRunningLate
              ? "text-[15px] font-medium text-warning"
              : "text-[15px] text-muted"
          }
        >
          {state.statusLine}
        </span>
      </div>

      {state.focusBlock ? (
        <UpNextCard
          block={state.focusBlock}
          timeZone={timeZone}
          isNow={Boolean(state.currentBlock)}
          isLate={isRunningLate}
          onCantDoThis={() => setActionBlock(state.focusBlock)}
        />
      ) : state.status === "unplanned" ? (
        <EmptyState
          icon={CalendarX2}
          title="Your day isn't planned yet."
          description={
            openTasks.length
              ? `${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"} waiting. DayOS will fit them around your commitments.`
              : "Add what you need to get done and DayOS will build the day around it."
          }
          action={
            openTasks.length ? (
              <PlanDayButton size="lg" onPlanned={setLastPlan} />
            ) : (
              <Button asChild size="lg">
                <Link href="/tasks">
                  <Plus className="h-4 w-4" aria-hidden />
                  Add a task
                </Link>
              </Button>
            )
          }
        />
      ) : suggestion ? (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-[11px] font-semibold tracking-wider text-faint uppercase">
            You&apos;re free right now
          </h2>
          <p className="mt-3 text-[22px] leading-tight font-semibold tracking-tight">
            {suggestion.title}
          </p>
          <p className="mt-1.5 text-sm text-muted">
            Highest-value thing you could pick up ·{" "}
            {formatDuration(suggestion.estimated_duration)}
          </p>
          <div className="mt-5">
            <PlanDayButton
              size="lg"
              label="Plan the rest of my day"
              className="w-full"
              onPlanned={setLastPlan}
            />
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Zap}
          title="Everything you planned is done."
          description="Nothing left on today's schedule. Enjoy the gap."
        />
      )}

      {lastPlan ? (
        <div
          role="status"
          className="animate-fade mt-4 rounded-xl bg-accent-soft px-3.5 py-3 text-sm"
        >
          <p>{lastPlan.summary}</p>
          {lastPlan.deferred.length ? (
            <ul className="mt-2 space-y-0.5 text-[13px] text-muted">
              {lastPlan.deferred.slice(0, 4).map((d) => (
                <li key={d.taskId}>
                  <span className="font-medium">{d.title}</span> — {d.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {isRunningLate ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 px-3.5 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-sm">
            {state.missedBlocks.length}{" "}
            {state.missedBlocks.length === 1 ? "session" : "sessions"} slipped
            past.
          </p>
          <PlanDayButton size="sm" label="Replan" onPlanned={setLastPlan} />
        </div>
      ) : null}

      {blocks.length > 0 ? (
        <section className="mt-8" aria-labelledby="schedule-heading">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2
              id="schedule-heading"
              className="text-[11px] font-semibold tracking-wider text-faint uppercase"
            >
              Today&apos;s schedule
            </h2>
            <span className="text-xs text-muted">
              {state.completedCount} of{" "}
              {blocks.filter((b) => b.kind !== "break").length} done
            </span>
          </div>
          <Timeline
            blocks={blocks}
            timeZone={timeZone}
            now={now}
            onAction={setActionBlock}
          />
          <div className="mt-4 flex justify-center">
            <PlanDayButton
              variant="ghost"
              size="sm"
              label="Replan the rest of today"
              onPlanned={setLastPlan}
            />
          </div>
        </section>
      ) : null}

      {state.overdueTasks.length > 0 ? (
        <section className="mt-8" aria-labelledby="overdue-heading">
          <h2
            id="overdue-heading"
            className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-danger uppercase"
          >
            Past due
          </h2>
          <ul className="space-y-2">
            {state.overdueTasks.slice(0, 5).map((task) => (
              <li
                key={task.id}
                className="rounded-xl border border-danger/30 bg-surface px-3.5 py-3"
              >
                <p className="text-[15px] font-medium">{task.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {task.category} · {formatDuration(task.estimated_duration)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BlockActionsSheet
        block={actionBlock}
        open={Boolean(actionBlock)}
        onOpenChange={(open) => !open && setActionBlock(null)}
      />
    </>
  );
}
