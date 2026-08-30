import { redirect } from "next/navigation";
import {
  PlanScreen,
  type PlanFixedEvent,
  type PlanView,
} from "@/components/plan/plan-screen";
import { getUserContext } from "@/lib/data/profile";
import { listBlocksInRange, listFixedEvents } from "@/lib/data/schedule";
import { resolveFixedEvent } from "@/lib/planner/availability";
import {
  addDaysToKey,
  localDateKey,
  parseTimeOfDay,
  startOfWeekKey,
  wallClockIn,
} from "@/lib/utils/time";

export const metadata = { title: "Plan" };

const VIEWS: PlanView[] = ["day", "week", "month"];

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const todayKey = localDateKey(now, ctx.timeZone);

  const view = (VIEWS.includes(params.view as PlanView)
    ? params.view
    : "day") as PlanView;
  const anchorKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? (params.date as string)
    : todayKey;

  // Load exactly the range the chosen view renders.
  const { rangeStart, rangeEnd } = rangeFor(view, anchorKey);

  const [blocks, fixed] = await Promise.all([
    listBlocksInRange(ctx.userId, rangeStart, rangeEnd),
    listFixedEvents(ctx.userId),
  ]);

  // Fixed commitments recur weekly, so they're resolved per visible day.
  const fixedEvents: PlanFixedEvent[] = [];
  for (
    let dateKey = rangeStart;
    dateKey <= rangeEnd;
    dateKey = addDaysToKey(dateKey, 1)
  ) {
    for (const event of fixed) {
      const resolved = resolveFixedEvent(event, dateKey, ctx.timeZone);
      if (!resolved) continue;
      const start = wallClockIn(new Date(resolved.start), ctx.timeZone);
      const end = wallClockIn(new Date(resolved.end), ctx.timeZone);
      fixedEvents.push({
        id: `${event.id}-${dateKey}`,
        title: resolved.title,
        category: resolved.category,
        dateKey,
        startMinute: start.hour * 60 + start.minute,
        endMinute: end.hour * 60 + end.minute || 24 * 60,
      });
    }
  }

  const wake = parseTimeOfDay(ctx.profile.wake_time);
  const bed = parseTimeOfDay(ctx.profile.bed_time);
  const earliest = Math.min(
    wake.hour,
    ...fixedEvents.map((e) => Math.floor(e.startMinute / 60)),
  );
  const latest = Math.max(
    bed.minute > 0 ? bed.hour + 1 : bed.hour,
    ...fixedEvents.map((e) => Math.ceil(e.endMinute / 60)),
  );

  return (
    <PlanScreen
      view={view}
      anchorKey={anchorKey}
      todayKey={todayKey}
      blocks={blocks}
      fixedEvents={fixedEvents}
      timeZone={ctx.timeZone}
      dayStartHour={Math.max(0, Math.min(earliest, 23))}
      dayEndHour={Math.min(24, Math.max(latest, earliest + 1))}
      serverNow={now.toISOString()}
    />
  );
}

function rangeFor(view: PlanView, anchorKey: string) {
  if (view === "day") return { rangeStart: anchorKey, rangeEnd: anchorKey };
  if (view === "week") {
    const start = startOfWeekKey(anchorKey);
    return { rangeStart: start, rangeEnd: addDaysToKey(start, 6) };
  }
  const [year, month] = anchorKey.split("-").map(Number);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const gridStart = startOfWeekKey(first);
  return { rangeStart: gridStart, rangeEnd: addDaysToKey(gridStart, 41) };
}
