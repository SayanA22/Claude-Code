"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Pause, Play, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { completeBlock } from "@/app/actions/schedule";
import { formatRange } from "@/lib/utils/time";
import { useNowMs } from "@/lib/hooks/use-now";
import type { ScheduleBlockWithTask } from "@/types/db";

/**
 * Focus Mode.
 *
 * One task, one countdown, four controls. The timer is derived from wall-clock
 * timestamps rather than counted in state, so it stays honest across a locked
 * screen or a backgrounded tab.
 */
export function FocusSession({
  block,
  nextBlock,
  timeZone,
  serverNow,
}: {
  block: ScheduleBlockWithTask;
  nextBlock: ScheduleBlockWithTask | null;
  timeZone: string;
  serverNow: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const plannedMs =
    new Date(block.end_at).getTime() - new Date(block.start_at).getTime();

  const now = useNowMs(250, Date.parse(serverNow));

  const [addedMs, setAddedMs] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  // The countdown is derived from timestamps rather than counted down in
  // state, so it survives a locked screen or a backgrounded tab — neither of
  // which should be able to buy the user extra time.
  //
  // The anchor is the server's render time: the user arrives here immediately
  // after pressing Start, so that instant is the session's start.
  const [anchor] = React.useState(() => Date.parse(serverNow));
  const [pausedAt, setPausedAt] = React.useState<number | null>(null);
  const [pausedTotal, setPausedTotal] = React.useState(0);

  const paused = pausedAt !== null;
  const totalMs = plannedMs + addedMs;
  const remaining = Math.max(
    0,
    anchor + totalMs + pausedTotal - (pausedAt ?? now),
  );

  function togglePause() {
    if (pausedAt !== null) {
      setPausedTotal((total) => total + (Date.now() - pausedAt));
      setPausedAt(null);
    } else {
      setPausedAt(Date.now());
    }
  }

  function addTime(minutes: number) {
    setAddedMs((value) => value + minutes * 60_000);
  }

  async function finish() {
    setPending(true);
    const activeMs = Date.now() - anchor - pausedTotal;
    const spent = Math.max(1, Math.round(activeMs / 60_000));

    const result = await completeBlock({
      blockId: block.id,
      actualMinutes: spent,
    });
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setFinished(true);
    router.refresh();
  }

  const elapsed = Math.min(1, Math.max(0, 1 - remaining / Math.max(1, totalMs)));
  const overrun = remaining === 0;

  if (finished) {
    return (
      <div className="animate-rise flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Nice. What&apos;s next?
        </h1>

        {nextBlock ? (
          <div className="mt-6 w-full max-w-sm rounded-2xl border border-border bg-surface p-5 text-left">
            <p className="text-[0.75rem] font-semibold tracking-wider text-faint uppercase">
              Up next
            </p>
            <p className="mt-2 text-[1.1875rem] leading-tight font-semibold">
              {nextBlock.title}
            </p>
            <p className="tnum mt-1 text-sm text-muted">
              {formatRange(
                new Date(nextBlock.start_at),
                new Date(nextBlock.end_at),
                timeZone,
              )}
            </p>
            <Button asChild className="mt-4 w-full">
              <Link href={`/focus/${nextBlock.id}`}>
                Start this
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        ) : (
          <p className="mt-3 max-w-xs text-sm text-muted">
            Nothing else is scheduled today.
          </p>
        )}

        <Button asChild variant="ghost" className="mt-4">
          <Link href="/today">Back to today</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col px-6 py-8">
      <div className="flex justify-end">
        <Button asChild variant="ghost" size="icon" aria-label="Exit focus mode">
          <Link href="/today">
            <X className="h-5 w-5" aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-sm text-muted">{block.task?.category ?? "Focus"}</p>
        <h1 className="mt-1.5 max-w-md text-2xl leading-tight font-semibold tracking-tight">
          {block.title}
        </h1>
        {block.task?.description ? (
          <p className="mt-2 max-w-sm text-sm text-muted">
            {block.task.description}
          </p>
        ) : null}

        <div className="relative mt-10">
          <svg
            viewBox="0 0 120 120"
            className="h-56 w-56 -rotate-90"
            aria-hidden
          >
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--color-surface-2)"
              strokeWidth="6"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={overrun ? "var(--color-warning)" : "var(--color-accent)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 54}
              strokeDashoffset={2 * Math.PI * 54 * (1 - elapsed)}
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p
              className="tnum text-[2.625rem] leading-none font-semibold tracking-tight"
              role="timer"
              aria-live="off"
            >
              {formatCountdown(remaining)}
            </p>
            <p className="mt-1.5 text-xs text-muted">
              {overrun ? "Time's up" : paused ? "Paused" : "remaining"}
            </p>
          </div>
        </div>
        {/* A polite, low-frequency announcement for screen readers. */}
        <p className="sr-only" aria-live="polite">
          {overrun
            ? "Session time is up"
            : `${Math.ceil(remaining / 60000)} minutes remaining`}
        </p>
      </div>

      <div className="mx-auto w-full max-w-sm space-y-2 pb-safe">
        <Button size="lg" className="w-full" onClick={finish} loading={pending}>
          <Check className="h-4 w-4" aria-hidden />
          Complete
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={togglePause}>
            {paused ? (
              <>
                <Play className="h-4 w-4" aria-hidden />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" aria-hidden />
                Pause
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => addTime(5)}
          >
            <Plus className="h-4 w-4" aria-hidden />5 min
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
