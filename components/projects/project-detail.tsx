"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ListPlus,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskRow } from "@/components/tasks/task-row";
import { setTaskStatus } from "@/app/actions/tasks";
import {
  proposeBreakdown,
  saveBreakdown,
  type BreakdownProposal,
} from "@/app/actions/projects";
import { useNowMs } from "@/lib/hooks/use-now";
import { formatDuration, formatRelativeDay } from "@/lib/utils/time";
import type { Project, Task } from "@/types/db";
import { ProjectForm } from "./project-form";

const ASSISTANT_PROMPTS = [
  "What should I work on next?",
  "Am I on track?",
  "Make me a plan for this",
];

/**
 * A project: what it is, how far along it is, and the four things a student
 * actually wants to ask about it.
 */
export function ProjectDetail({
  project,
  tasks,
  todayKey,
  timeZone,
  serverNow,
}: {
  project: Project;
  tasks: Task[];
  todayKey: string;
  timeZone: string;
  serverNow: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const nowMs = useNowMs(60_000, Date.parse(serverNow));

  const [editing, setEditing] = React.useState(false);
  const [addingTask, setAddingTask] = React.useState(false);
  const [askingWith, setAskingWith] = React.useState<string | null>(null);
  const [proposal, setProposal] = React.useState<BreakdownProposal | null>(null);
  const [keep, setKeep] = React.useState<boolean[]>([]);
  const [pending, setPending] = React.useState(false);

  const done = tasks.filter((t) => t.status === "completed").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const remaining = tasks
    .filter((t) => t.status !== "completed")
    .reduce((sum, t) => sum + t.estimated_duration, 0);

  function toggle(task: Task, complete: boolean) {
    React.startTransition(async () => {
      const result = await setTaskStatus({
        id: task.id,
        status: complete ? "completed" : "todo",
      });
      if (!result.ok) toast(result.error, "error");
      else router.refresh();
    });
  }

  async function runBreakdown() {
    setPending(true);
    const result = await proposeBreakdown(project.id);
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setProposal(result.data);
    setKeep(result.data.tasks.map(() => true));
  }

  async function commitBreakdown() {
    if (!proposal) return;
    const chosen = proposal.tasks.filter((_, i) => keep[i]);
    if (!chosen.length) {
      setProposal(null);
      return;
    }
    setPending(true);
    const result = await saveBreakdown({ projectId: project.id, tasks: chosen });
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Added ${result.data.created} tasks`, "success");
    setProposal(null);
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Projects
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditing(true)}
          aria-label="Edit project"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <header className="mb-5">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
          {project.title}
        </h1>
        {project.description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {project.description}
          </p>
        ) : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span>{project.category}</span>
          {project.deadline ? (
            <span>Due {formatRelativeDay(project.deadline, todayKey)}</span>
          ) : (
            <span>No deadline</span>
          )}
          {remaining > 0 ? (
            <span>{formatDuration(remaining)} of work left</span>
          ) : null}
        </p>
      </header>

      <section aria-label="Progress" className="mb-6">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-faint uppercase">
            Progress
          </span>
          <span className="tnum text-sm font-medium">
            {progress}%
            <span className="ml-1.5 font-normal text-muted">
              {done}/{tasks.length}
            </span>
          </span>
        </div>
        <Progress value={progress} label={`${project.title} progress`} />
      </section>

      <section className="mb-6" aria-labelledby="project-ai">
        <h2
          id="project-ai"
          className="mb-2 text-[11px] font-semibold tracking-wider text-faint uppercase"
        >
          Project assistant
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={runBreakdown}
            loading={pending && !proposal}
          >
            <ListPlus className="h-4 w-4" aria-hidden />
            Break this down
          </Button>
          {ASSISTANT_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              variant="secondary"
              size="sm"
              onClick={() =>
                setAskingWith(
                  `About my project "${project.title}": ${prompt}`,
                )
              }
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {prompt}
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="project-tasks">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2
            id="project-tasks"
            className="text-[11px] font-semibold tracking-wider text-faint uppercase"
          >
            Tasks
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setAddingTask(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </Button>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            icon={ListPlus}
            title="No tasks yet."
            description="Let DayOS break the project into steps, or add the first one yourself."
            action={
              <Button onClick={runBreakdown} loading={pending}>
                <ListPlus className="h-4 w-4" aria-hidden />
                Break this down
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                todayKey={todayKey}
                timeZone={timeZone}
                nowMs={nowMs}
                onToggle={toggle}
                onOpen={() => router.push("/tasks")}
              />
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={Boolean(proposal)}
        onOpenChange={(open) => !open && setProposal(null)}
      >
        <SheetContent
          title="Proposed breakdown"
          description="Uncheck anything you don't want. Nothing is saved until you confirm."
        >
          {proposal ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
                {proposal.summary}
              </p>

              <ul className="space-y-2">
                {proposal.tasks.map((task, i) => (
                  <li
                    key={`${task.title}-${i}`}
                    className="flex items-start gap-3 rounded-xl border border-border px-3.5 py-3"
                  >
                    <input
                      type="checkbox"
                      id={`keep-${i}`}
                      checked={keep[i] ?? true}
                      onChange={(e) =>
                        setKeep((k) =>
                          k.map((v, j) => (j === i ? e.target.checked : v)),
                        )
                      }
                      className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <label htmlFor={`keep-${i}`} className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">
                        {task.title}
                      </span>
                      {task.description ? (
                        <span className="mt-0.5 block text-xs text-muted">
                          {task.description}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-faint">
                        {formatDuration(task.estimated_duration)} · {task.priority}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setProposal(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={commitBreakdown}
                  loading={pending}
                >
                  Add {keep.filter(Boolean).length} tasks
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent title="Edit project">
          <ProjectForm project={project} onDone={() => setEditing(false)} />
        </SheetContent>
      </Sheet>

      <Sheet open={addingTask} onOpenChange={setAddingTask}>
        <SheetContent title="Add a task" description={project.title}>
          <TaskForm
            timeZone={timeZone}
            todayKey={todayKey}
            projectId={project.id}
            initial={{ category: project.category }}
            onDone={() => {
              setAddingTask(false);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(askingWith)}
        onOpenChange={(open) => !open && setAskingWith(null)}
      >
        <SheetContent title="Project assistant">
          {askingWith ? <AssistantPanel initialQuestion={askingWith} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
