"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlanDayButton } from "@/components/today/plan-day-button";
import { BlockActionsSheet } from "@/components/today/block-actions";
import { PageHeader } from "@/components/page-header";
import { useNowMs } from "@/lib/hooks/use-now";
import { categoryColor } from "@/lib/utils/category";
import {
  addDaysToKey,
  daysBetweenKeys,
  formatDuration,
  startOfWeekKey,
  wallClockIn,
} from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { ScheduleBlockWithTask } from "@/types/db";
import { DayGrid, type DayGridEvent } from "./day-grid";

export type PlanView = "day" | "week" | "month";

export interface PlanFixedEvent {
  id: string;
  title: string;
  category: string;
  dateKey: string;
  startMinute: number;
  endMinute: number;
}

/**
 * The calendar. Day, week and month over the same data.
 *
 * The structure is deliberately source-agnostic: blocks and fixed commitments
 * arrive as plain events, so an external calendar feed can be folded in later
 * without touching the views.
 */
export function PlanScreen({
  view,
  anchorKey,
  todayKey,
  blocks,
  fixedEvents,
  timeZone,
  dayStartHour,
  dayEndHour,
  serverNow,
}: {
  view: PlanView;
  anchorKey: string;
  todayKey: string;
  blocks: ScheduleBlockWithTask[];
  fixedEvents: PlanFixedEvent[];
  timeZone: string;
  dayStartHour: number;
  dayEndHour: number;
  serverNow: string;
}) {
  const router = useRouter();
  const nowMs = useNowMs(60_000, Date.parse(serverNow));
  const [actionBlock, setActionBlock] =
    React.useState<ScheduleBlockWithTask | null>(null);

  const now = React.useMemo(() => new Date(nowMs), [nowMs]);
  const nowClock = wallClockIn(now, timeZone);
  const nowMinute = nowClock.hour * 60 + nowClock.minute;

  const navigate = React.useCallback(
    (nextView: PlanView, nextKey: string) => {
      router.push(`/plan?view=${nextView}&date=${nextKey}`);
    },
    [router],
  );

  const step = view === "day" ? 1 : view === "week" ? 7 : 30;

  const blocksByDay = React.useMemo(() => {
    const map = new Map<string, ScheduleBlockWithTask[]>();
    for (const block of blocks) {
      const list = map.get(block.local_date) ?? [];
      list.push(block);
      map.set(block.local_date, list);
    }
    return map;
  }, [blocks]);

  const eventsForDay = React.useCallback(
    (dateKey: string): DayGridEvent[] => {
      const dayBlocks = (blocksByDay.get(dateKey) ?? []).map((block) => {
        const start = wallClockIn(new Date(block.start_at), timeZone);
        const end = wallClockIn(new Date(block.end_at), timeZone);
        return {
          id: block.id,
          title: block.title,
          category: block.task?.category ?? "Other",
          startMinute: start.hour * 60 + start.minute,
          endMinute: end.hour * 60 + end.minute || 24 * 60,
          kind: block.kind,
          status: block.status,
          movable: block.status === "planned" && block.kind !== "fixed",
          block,
        } satisfies DayGridEvent;
      });

      const fixed = fixedEvents
        .filter((e) => e.dateKey === dateKey)
        .map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          startMinute: e.startMinute,
          endMinute: e.endMinute,
          kind: "fixed" as const,
          movable: false,
        }));

      return [...fixed, ...dayBlocks];
    },
    [blocksByDay, fixedEvents, timeZone],
  );

  const title =
    view === "day"
      ? formatDayTitle(anchorKey, todayKey)
      : view === "week"
        ? `Week of ${formatMonthDay(startOfWeekKey(anchorKey))}`
        : formatMonthYear(anchorKey);

  return (
    <>
      <PageHeader
        title="Plan"
        subtitle={title}
        action={<PlanDayButton size="sm" label="Plan today" />}
      />

      <div className="mb-4 flex items-center gap-2">
        <div
          role="tablist"
          aria-label="Calendar view"
          className="flex flex-1 rounded-xl border border-border bg-surface p-0.5"
        >
          {(["day", "week", "month"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={view === value}
              onClick={() => navigate(value, anchorKey)}
              className={cn(
                "flex-1 rounded-[9px] px-3 py-2 text-sm capitalize transition-colors",
                view === value
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous"
            onClick={() => navigate(view, addDaysToKey(anchorKey, -step))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(view, todayKey)}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next"
            onClick={() => navigate(view, addDaysToKey(anchorKey, step))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {view === "day" ? (
        blocks.length === 0 && fixedEvents.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="Nothing on this day."
            description="Plan the day and DayOS will fill it around your commitments."
            action={anchorKey === todayKey ? <PlanDayButton /> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <DayGrid
              events={eventsForDay(anchorKey)}
              startHour={dayStartHour}
              endHour={dayEndHour}
              timeZone={timeZone}
              nowMinute={nowMinute}
              showNowLine={anchorKey === todayKey}
              onSelect={(event) =>
                event.block ? setActionBlock(event.block) : undefined
              }
            />
          </div>
        )
      ) : null}

      {view === "week" ? (
        <WeekView
          weekStart={startOfWeekKey(anchorKey)}
          todayKey={todayKey}
          eventsForDay={eventsForDay}
          onOpenDay={(key) => navigate("day", key)}
          dayStartHour={dayStartHour}
          dayEndHour={dayEndHour}
        />
      ) : null}

      {view === "month" ? (
        <MonthView
          anchorKey={anchorKey}
          todayKey={todayKey}
          blocksByDay={blocksByDay}
          onOpenDay={(key) => navigate("day", key)}
        />
      ) : null}

      <BlockActionsSheet
        block={actionBlock}
        open={Boolean(actionBlock)}
        onOpenChange={(open) => !open && setActionBlock(null)}
      />
    </>
  );
}

function WeekView({
  weekStart,
  todayKey,
  eventsForDay,
  onOpenDay,
  dayStartHour,
  dayEndHour,
}: {
  weekStart: string;
  todayKey: string;
  eventsForDay: (dateKey: string) => DayGridEvent[];
  onOpenDay: (dateKey: string) => void;
  dayStartHour: number;
  dayEndHour: number;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const span = (dayEndHour - dayStartHour) * 60;

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((dateKey) => {
        const events = eventsForDay(dateKey);
        const isToday = dateKey === todayKey;
        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onOpenDay(dateKey)}
            className={cn(
              "rounded-xl border p-1.5 text-left transition-colors hover:border-border-strong",
              isToday ? "border-accent bg-accent-soft/40" : "border-border",
            )}
          >
            <p className="text-center text-[0.625rem] tracking-wider text-faint uppercase">
              {weekdayLabel(dateKey)}
            </p>
            <p
              className={cn(
                "tnum text-center text-sm font-semibold",
                isToday && "text-accent",
              )}
            >
              {Number(dateKey.slice(8))}
            </p>

            <div className="relative mt-1.5 h-32 overflow-hidden rounded-md bg-surface-2">
              {events.map((event) => {
                const top =
                  ((event.startMinute - dayStartHour * 60) / span) * 100;
                const height =
                  ((event.endMinute - event.startMinute) / span) * 100;
                if (top > 100 || top + height < 0) return null;
                return (
                  <span
                    key={event.id}
                    className="absolute right-0.5 left-0.5 rounded-[3px]"
                    style={{
                      top: `${Math.max(0, top)}%`,
                      height: `${Math.max(2, Math.min(100, height))}%`,
                      backgroundColor:
                        event.kind === "fixed"
                          ? "var(--color-border-strong)"
                          : categoryColor(event.category),
                      opacity: event.status === "completed" ? 0.4 : 0.85,
                    }}
                    title={event.title}
                  />
                );
              })}
            </div>
            <p className="mt-1 text-center text-[0.625rem] text-muted">
              {events.filter((e) => e.kind !== "fixed").length || ""}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function MonthView({
  anchorKey,
  todayKey,
  blocksByDay,
  onOpenDay,
}: {
  anchorKey: string;
  todayKey: string;
  blocksByDay: Map<string, ScheduleBlockWithTask[]>;
  onOpenDay: (dateKey: string) => void;
}) {
  const [year, month] = anchorKey.split("-").map(Number);
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const gridStart = startOfWeekKey(firstOfMonth);
  const cells = Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <p
            key={d}
            className="text-center text-[0.625rem] tracking-wider text-faint uppercase"
          >
            {d}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateKey) => {
          const inMonth = dateKey.startsWith(
            `${year}-${String(month).padStart(2, "0")}`,
          );
          const dayBlocks = (blocksByDay.get(dateKey) ?? []).filter(
            (b) => b.kind !== "break",
          );
          const isToday = dateKey === todayKey;
          const minutes = dayBlocks.reduce(
            (sum, b) =>
              sum +
              (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) /
                60_000,
            0,
          );

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onOpenDay(dateKey)}
              className={cn(
                "aspect-square rounded-lg border p-1 transition-colors hover:border-border-strong",
                isToday ? "border-accent bg-accent-soft/40" : "border-border",
                !inMonth && "opacity-40",
              )}
            >
              <p
                className={cn(
                  "tnum text-[0.75rem] font-medium",
                  isToday && "text-accent",
                )}
              >
                {Number(dateKey.slice(8))}
              </p>
              {dayBlocks.length ? (
                <>
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {dayBlocks.slice(0, 4).map((b) => (
                      <span
                        key={b.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: categoryColor(
                            b.task?.category ?? "Other",
                          ),
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-0.5 text-[0.5625rem] text-faint">
                    {formatDuration(minutes)}
                  </p>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Tap a day to open it.
      </p>
    </div>
  );
}

function utcProxy(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function weekdayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(utcProxy(dateKey));
}

function formatMonthDay(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcProxy(dateKey));
}

function formatMonthYear(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcProxy(dateKey));
}

function formatDayTitle(dateKey: string, todayKey: string): string {
  const diff = daysBetweenKeys(todayKey, dateKey);
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcProxy(dateKey));
  if (diff === 0) return `Today · ${label}`;
  if (diff === 1) return `Tomorrow · ${label}`;
  if (diff === -1) return `Yesterday · ${label}`;
  return label;
}
