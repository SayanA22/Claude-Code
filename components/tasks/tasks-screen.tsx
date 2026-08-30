"use client";

import * as React from "react";
import { ListChecks, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { setTaskStatus } from "@/app/actions/tasks";
import { addDaysToKey, daysBetweenKeys } from "@/lib/utils/time";
import { useNowMs } from "@/lib/hooks/use-now";
import type { Task } from "@/types/db";
import { TaskForm } from "./task-form";
import { TaskRow } from "./task-row";

type Bucket = {
  key: string;
  label: string;
  tasks: Task[];
};

/**
 * Groups open tasks by when they're due, so the list answers "what's
 * pressing?" before it answers "what exists?".
 */
function bucketTasks(
  tasks: Task[],
  todayKey: string,
  timeZone: string,
  nowMs: number,
): Bucket[] {
  const buckets: Record<string, Task[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    later: [],
    undated: [],
  };

  for (const task of tasks) {
    if (!task.deadline) {
      buckets.undated.push(task);
      continue;
    }
    const due = new Date(task.deadline).getTime();
    if (due < nowMs) {
      buckets.overdue.push(task);
      continue;
    }
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(task.deadline));
    const diff = daysBetweenKeys(todayKey, key);
    if (diff <= 0) buckets.today.push(task);
    else if (diff === 1) buckets.tomorrow.push(task);
    else if (diff <= 7) buckets.week.push(task);
    else buckets.later.push(task);
  }

  const labels: [string, string][] = [
    ["overdue", "Overdue"],
    ["today", "Due today"],
    ["tomorrow", "Tomorrow"],
    ["week", "This week"],
    ["later", "Later"],
    ["undated", "No date"],
  ];

  return labels
    .map(([key, label]) => ({ key, label, tasks: buckets[key] }))
    .filter((b) => b.tasks.length > 0);
}

export function TasksScreen({
  initialTasks,
  todayKey,
  timeZone,
  serverNow,
}: {
  initialTasks: Task[];
  todayKey: string;
  timeZone: string;
  serverNow: string;
}) {
  const { toast } = useToast();
  const nowMs = useNowMs(60_000, Date.parse(serverNow));

  // Completion settles instantly and rolls back on its own if the server
  // rejects it — `useOptimistic` drops the overlay when the action resolves
  // and the route re-renders with the real rows.
  const [tasks, applyCompletion] = React.useOptimistic(
    initialTasks,
    (state: Task[], patch: { id: string; complete: boolean }) =>
      state.map((t) =>
        t.id === patch.id
          ? {
              ...t,
              status: patch.complete ? ("completed" as const) : ("todo" as const),
              completed_at: patch.complete ? new Date(nowMs).toISOString() : null,
            }
          : t,
      ),
  );

  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState<"open" | "done">("open");
  const [editing, setEditing] = React.useState<Task | null>(null);
  const [creating, setCreating] = React.useState(false);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesTab =
        tab === "done" ? t.status === "completed" : t.status !== "completed";
      if (!matchesTab) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, query, tab]);

  const buckets = React.useMemo(
    () =>
      tab === "open"
        ? bucketTasks(visible, todayKey, timeZone, nowMs)
        : [{ key: "done", label: "Completed", tasks: visible }],
    [visible, tab, todayKey, timeZone, nowMs],
  );

  function toggle(task: Task, complete: boolean) {
    React.startTransition(async () => {
      applyCompletion({ id: task.id, complete });
      const result = await setTaskStatus({
        id: task.id,
        status: complete ? "completed" : "todo",
      });
      if (!result.ok) toast(result.error, "error");
    });
  }

  const openCount = tasks.filter((t) => t.status !== "completed").length;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={
          openCount === 0
            ? "Nothing open."
            : `${openCount} open ${openCount === 1 ? "task" : "tasks"}`
        }
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="pl-9"
          />
        </div>
        <div
          role="tablist"
          aria-label="Filter tasks"
          className="flex rounded-xl border border-border bg-surface p-0.5"
        >
          {(["open", "done"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? "rounded-[9px] bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
                  : "rounded-[9px] px-3 py-2 text-sm text-muted"
              }
            >
              {value === "open" ? "Open" : "Done"}
            </button>
          ))}
        </div>
      </div>

      {buckets.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={
            query
              ? "Nothing matches that."
              : tab === "done"
                ? "Nothing finished yet."
                : "You're all clear."
          }
          description={
            query
              ? undefined
              : tab === "done"
                ? "Completed tasks will collect here."
                : "Add something you need to get done."
          }
          action={
            query || tab === "done" ? null : (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Add a task
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          {buckets.map((bucket) => (
            <section key={bucket.key} aria-labelledby={`bucket-${bucket.key}`}>
              <h2
                id={`bucket-${bucket.key}`}
                className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-faint uppercase"
              >
                {bucket.label}
                <span className="ml-1.5 font-normal normal-case">
                  {bucket.tasks.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {bucket.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    todayKey={todayKey}
                    timeZone={timeZone}
                    nowMs={nowMs}
                    onToggle={toggle}
                    onOpen={setEditing}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent title="New task" description="DayOS will find time for it.">
          <TaskForm
            timeZone={timeZone}
            todayKey={todayKey}
            initial={{ deadlineDate: addDaysToKey(todayKey, 1) }}
            onDone={() => setCreating(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <SheetContent title="Edit task">
          {editing ? (
            <TaskForm
              task={editing}
              timeZone={timeZone}
              todayKey={todayKey}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
