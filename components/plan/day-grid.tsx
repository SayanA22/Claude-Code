"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { moveBlock } from "@/app/actions/schedule";
import { categoryColor } from "@/lib/utils/category";
import { formatClock, minutesToTimeString } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { ScheduleBlockWithTask } from "@/types/db";

/**
 * A single day as an hour grid.
 *
 * Blocks can be dragged to a new time on any pointer device (mouse, pen or
 * touch), snapping to 15 minutes. The move is rejected server-side if it would
 * collide with something else, so the "nothing overlaps" rule holds for manual
 * edits as well as generated ones.
 */

const PX_PER_HOUR = 60;
const SNAP_MINUTES = 15;

export interface DayGridEvent {
  id: string;
  title: string;
  category: string;
  startMinute: number;
  endMinute: number;
  kind: "task" | "break" | "fixed" | "buffer";
  status?: string;
  movable: boolean;
  block?: ScheduleBlockWithTask;
}

export function DayGrid({
  events,
  startHour,
  endHour,
  timeZone,
  nowMinute,
  showNowLine,
  onSelect,
}: {
  events: DayGridEvent[];
  startHour: number;
  endHour: number;
  timeZone: string;
  nowMinute: number;
  showNowLine: boolean;
  onSelect?: (event: DayGridEvent) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [dragging, setDragging] = React.useState<{
    id: string;
    offsetMinutes: number;
  } | null>(null);
  const pointerStart = React.useRef(0);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * PX_PER_HOUR;
  const minuteToY = (minute: number) =>
    ((minute - startHour * 60) / 60) * PX_PER_HOUR;

  function onPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    item: DayGridEvent,
  ) {
    if (!item.movable) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    pointerStart.current = event.clientY;
    setDragging({ id: item.id, offsetMinutes: 0 });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const deltaPx = event.clientY - pointerStart.current;
    const deltaMinutes = (deltaPx / PX_PER_HOUR) * 60;
    const snapped =
      Math.round(deltaMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    setDragging((d) => (d ? { ...d, offsetMinutes: snapped } : d));
  }

  async function onPointerUp(item: DayGridEvent) {
    if (!dragging || dragging.id !== item.id) return;
    const offset = dragging.offsetMinutes;
    setDragging(null);
    if (!offset || !item.block) return;

    const newStart = new Date(
      new Date(item.block.start_at).getTime() + offset * 60_000,
    );
    const result = await moveBlock({
      blockId: item.block.id,
      start: newStart.toISOString(),
    });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Moved to ${formatClock(newStart, timeZone)}`, "success");
    router.refresh();
  }

  return (
    // The hour labels sit above their gridline, so the grid needs top padding
    // or the first one is clipped.
    <div className="relative flex pt-2">
      <div className="w-14 shrink-0">
        {hours.map((hour) => (
          <div
            key={hour}
            style={{ height: PX_PER_HOUR }}
            className="tnum relative -top-2 pr-2 text-right text-[0.75rem] text-faint"
          >
            {hour === 0
              ? "12 AM"
              : hour < 12
                ? `${hour} AM`
                : hour === 12
                  ? "12 PM"
                  : `${hour - 12} PM`}
          </div>
        ))}
      </div>

      <div
        className="relative flex-1 border-l border-border"
        style={{ height: gridHeight }}
      >
        {hours.map((hour, i) => (
          <div
            key={hour}
            className="absolute right-0 left-0 border-t border-border/60"
            style={{ top: i * PX_PER_HOUR }}
          />
        ))}

        {showNowLine &&
        nowMinute >= startHour * 60 &&
        nowMinute <= endHour * 60 ? (
          <div
            className="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
            style={{ top: minuteToY(nowMinute) }}
            aria-hidden
          >
            <span className="h-2 w-2 -translate-x-1 rounded-full bg-danger" />
            <span className="h-px flex-1 bg-danger" />
          </div>
        ) : null}

        {events.map((item) => {
          const isDragging = dragging?.id === item.id;
          const offset = isDragging ? dragging.offsetMinutes : 0;
          const top = minuteToY(item.startMinute + offset);
          // Height stays proportional to real duration — a calendar that
          // inflates short blocks lies about the day.
          const rawHeight =
            ((item.endMinute - item.startMinute) / 60) * PX_PER_HOUR;
          const done = item.status === "completed";
          const skipped = item.status === "skipped";
          const color = categoryColor(item.category);

          // A ten-minute break is eight pixels tall; a label would spill over
          // the block after it. Render it as a bar instead.
          if (item.kind === "break" && rawHeight < 22) {
            return (
              <div
                key={item.id}
                aria-label={`${item.title}, ${item.endMinute - item.startMinute} minutes`}
                title={item.title}
                className="absolute right-1 left-1 rounded-full bg-surface-2"
                style={{ top, height: Math.max(4, rawHeight - 2) }}
              />
            );
          }

          const height = Math.max(14, rawHeight - 2);
          const roomy = rawHeight >= 30;

          return (
            <div
              key={item.id}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={() => onSelect?.(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(item);
                }
              }}
              onPointerDown={(e) => onPointerDown(e, item)}
              onPointerMove={onPointerMove}
              onPointerUp={() => onPointerUp(item)}
              onPointerCancel={() => setDragging(null)}
              className={cn(
                "absolute right-1 left-1 overflow-hidden rounded-lg border text-left",
                roomy ? "px-2 py-1" : "px-2 py-0",
                item.kind === "fixed"
                  ? "border-dashed bg-surface-2"
                  : "bg-surface",
                item.movable ? "cursor-grab touch-none" : "",
                isDragging && "z-30 cursor-grabbing shadow-lg",
                (done || skipped) && "opacity-55",
              )}
              style={{
                top,
                height,
                borderColor: item.kind === "fixed" ? undefined : color,
                borderLeftWidth: item.kind === "fixed" ? 1 : 3,
              }}
            >
              <p
                className={cn(
                  "truncate text-[0.75rem] font-medium",
                  roomy ? "leading-tight" : "leading-[1.15]",
                  done && "line-through",
                )}
              >
                {item.title}
              </p>
              {rawHeight >= 40 ? (
                <p className="tnum truncate text-[0.75rem] text-muted">
                  {minutesToTimeString(item.startMinute + offset)} –{" "}
                  {minutesToTimeString(item.endMinute + offset)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
