"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ListPlus, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import {
  addMilestone,
  createGoal,
  deleteGoal,
  proposeGoalTasks,
  saveGoalTasks,
  setMilestoneComplete,
  type GoalTaskProposal,
} from "@/app/actions/goals";
import { formatDuration, formatRelativeDay } from "@/lib/utils/time";
import type { GoalWithDetail } from "@/lib/data/projects";
import { cn } from "@/lib/utils/cn";

/**
 * Goals are the "why" behind tasks. Each one tracks milestones and linked
 * tasks, and DayOS can turn a goal into concrete work — proposed first,
 * written only once the user keeps it.
 */
export function GoalsScreen({
  goals,
  todayKey,
}: {
  goals: GoalWithDetail[];
  todayKey: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = React.useState(false);
  const [milestoneFor, setMilestoneFor] = React.useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = React.useState("");
  const [proposal, setProposal] = React.useState<
    (GoalTaskProposal & { goalId: string }) | null
  >(null);
  const [keep, setKeep] = React.useState<boolean[]>([]);
  const [pending, setPending] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deadline, setDeadline] = React.useState("");

  async function submitGoal(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setPending("create");
    const result = await createGoal({ title, description, deadline });
    setPending(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setTitle("");
    setDescription("");
    setDeadline("");
    setCreating(false);
    toast("Goal added", "success");
    router.refresh();
  }

  async function breakDown(goalId: string) {
    setPending(goalId);
    const result = await proposeGoalTasks(goalId);
    setPending(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setProposal({ ...result.data, goalId });
    setKeep(result.data.tasks.map(() => true));
  }

  async function commit() {
    if (!proposal) return;
    const chosen = proposal.tasks.filter((_, i) => keep[i]);
    if (!chosen.length) {
      setProposal(null);
      return;
    }
    setPending("commit");
    const result = await saveGoalTasks({
      goalId: proposal.goalId,
      tasks: chosen,
    });
    setPending(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Added ${result.data.created} tasks`, "success");
    setProposal(null);
    router.refresh();
  }

  async function submitMilestone(event: React.FormEvent) {
    event.preventDefault();
    if (!milestoneFor || !milestoneTitle.trim()) return;
    setPending("milestone");
    const result = await addMilestone({
      goalId: milestoneFor,
      title: milestoneTitle,
    });
    setPending(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setMilestoneTitle("");
    setMilestoneFor(null);
    router.refresh();
  }

  function toggleMilestone(id: string, completed: boolean) {
    React.startTransition(async () => {
      const result = await setMilestoneComplete(id, completed);
      if (!result.ok) toast(result.error, "error");
      else router.refresh();
    });
  }

  async function remove(id: string) {
    setPending(id);
    const result = await deleteGoal(id);
    setPending(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Goal deleted");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Goals"
        subtitle={
          goals.length ? `${goals.length} active` : "What you're working toward."
        }
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet."
          description="A goal is the reason behind the tasks. Add one and DayOS can turn it into work you can actually schedule."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add a goal
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[1rem] font-semibold tracking-tight">
                        {goal.title}
                      </p>
                      {goal.description ? (
                        <p className="mt-1 text-sm text-muted">
                          {goal.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[0.8125rem] text-muted">
                        {goal.deadline
                          ? `Target ${formatRelativeDay(goal.deadline, todayKey)}`
                          : "No target date"}
                        {goal.taskIds.length
                          ? ` · ${goal.taskIds.length} linked tasks`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="tnum text-sm font-medium text-muted">
                        {goal.progress}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${goal.title}`}
                        onClick={() => remove(goal.id)}
                        disabled={pending === goal.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <Progress
                    value={goal.progress}
                    className="mt-3"
                    label={`${goal.title} progress`}
                  />

                  {goal.milestones.length ? (
                    <ul className="mt-3 space-y-1">
                      {goal.milestones.map((milestone) => (
                        <li key={milestone.id}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={milestone.completed}
                            onClick={() =>
                              toggleMilestone(milestone.id, !milestone.completed)
                            }
                            className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-surface-2"
                          >
                            <span
                              className={cn(
                                "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                                milestone.completed
                                  ? "border-success bg-success text-white"
                                  : "border-border-strong",
                              )}
                            >
                              {milestone.completed ? (
                                <Check className="h-2.5 w-2.5" strokeWidth={4} aria-hidden />
                              ) : null}
                            </span>
                            <span
                              className={cn(
                                "text-sm",
                                milestone.completed &&
                                  "text-muted line-through",
                              )}
                            >
                              {milestone.title}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => breakDown(goal.id)}
                      loading={pending === goal.id}
                    >
                      <ListPlus className="h-3.5 w-3.5" aria-hidden />
                      Turn into tasks
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMilestoneFor(goal.id)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Milestone
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent
          title="New goal"
          description="Something bigger than a task — DayOS will help you break it down."
        >
          <form onSubmit={submitGoal} className="space-y-4">
            <Field label="Goal" htmlFor="goal-title">
              <Input
                id="goal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Finish my science project"
                autoFocus
                required
                maxLength={160}
              />
            </Field>
            <Field label="Why does it matter?" htmlFor="goal-description">
              <Textarea
                id="goal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
              />
            </Field>
            <Field label="Target date" htmlFor="goal-deadline">
              <Input
                id="goal-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" loading={pending === "create"}>
              Add goal
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(milestoneFor)}
        onOpenChange={(open) => !open && setMilestoneFor(null)}
      >
        <SheetContent title="Add a milestone">
          <form onSubmit={submitMilestone} className="space-y-4">
            <Field label="Milestone" htmlFor="milestone-title">
              <Input
                id="milestone-title"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="Data collection finished"
                autoFocus
                required
                maxLength={200}
              />
            </Field>
            <Button
              type="submit"
              className="w-full"
              loading={pending === "milestone"}
            >
              Add milestone
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(proposal)}
        onOpenChange={(open) => !open && setProposal(null)}
      >
        <SheetContent
          title="Proposed tasks"
          description="Uncheck anything you don't want. Nothing saves until you confirm."
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
                      id={`goal-keep-${i}`}
                      checked={keep[i] ?? true}
                      onChange={(e) =>
                        setKeep((k) =>
                          k.map((v, j) => (j === i ? e.target.checked : v)),
                        )
                      }
                      className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <label htmlFor={`goal-keep-${i}`} className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-medium">
                        {task.title}
                      </span>
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
                  onClick={commit}
                  loading={pending === "commit"}
                >
                  Add {keep.filter(Boolean).length} tasks
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
