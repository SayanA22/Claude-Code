"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { parseCapture, type CaptureDraft } from "@/app/actions/capture";
import { createTasks } from "@/app/actions/tasks";
import { CATEGORIES, TASK_PRIORITIES } from "@/types/db";
import { formatDuration } from "@/lib/utils/time";

/**
 * Dump a messy thought, get tasks.
 *
 * Extraction is always shown before it is saved, and every field stays
 * editable — DayOS proposes, the user confirms.
 */
export function QuickCapture({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [drafts, setDrafts] = React.useState<CaptureDraft[] | null>(null);
  const [clarification, setClarification] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function extract() {
    if (!text.trim()) return;
    setPending(true);
    const result = await parseCapture({ text });
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    if (!result.data.drafts.length) {
      toast(
        result.data.clarification ?? "I couldn't find a task in that.",
        "error",
      );
      return;
    }
    setDrafts(result.data.drafts);
    setClarification(result.data.clarification);
  }

  async function save() {
    if (!drafts?.length) return;
    setPending(true);
    // `deadlineLabel` is display-only; the server takes the resolved deadline.
    const result = await createTasks(
      drafts.map((draft) => {
        const task = { ...draft } as Partial<CaptureDraft>;
        delete task.deadlineLabel;
        return task as Omit<CaptureDraft, "deadlineLabel">;
      }),
    );
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(
      drafts.length === 1 ? "Task added" : `${drafts.length} tasks added`,
      "success",
    );
    onDone();
    router.refresh();
  }

  function patch(index: number, changes: Partial<CaptureDraft>) {
    setDrafts((list) =>
      list ? list.map((d, i) => (i === index ? { ...d, ...changes } : d)) : list,
    );
  }

  if (drafts) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Here&apos;s what I got. Change anything that&apos;s off.
        </p>

        {clarification ? (
          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
            {clarification}
          </p>
        ) : null}

        <ul className="space-y-3">
          {drafts.map((draft, index) => (
            <li
              key={index}
              className="rounded-2xl border border-border bg-surface p-3.5"
            >
              <div className="flex items-start gap-2">
                <Input
                  value={draft.title}
                  onChange={(e) => patch(index, { title: e.target.value })}
                  aria-label={`Task ${index + 1} title`}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${draft.title}`}
                  onClick={() =>
                    setDrafts((list) =>
                      list ? list.filter((_, i) => i !== index) : list,
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <Select
                  value={draft.category as string}
                  onChange={(e) => patch(index, { category: e.target.value })}
                  aria-label={`Category for ${draft.title}`}
                  className="h-10 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Select
                  value={draft.priority as string}
                  onChange={(e) => patch(index, { priority: e.target.value })}
                  aria-label={`Priority for ${draft.title}`}
                  className="h-10 text-sm"
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={5}
                  max={600}
                  step={5}
                  value={draft.estimated_duration as number}
                  onChange={(e) =>
                    patch(index, {
                      estimated_duration: Number(e.target.value),
                    })
                  }
                  aria-label={`Minutes for ${draft.title}`}
                  className="h-10 text-sm"
                />
              </div>

              <p className="mt-2 text-xs text-muted">
                {draft.deadlineLabel
                  ? `Due ${draft.deadlineLabel}`
                  : "No due date"}
                {" · "}
                {formatDuration(draft.estimated_duration as number)}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setDrafts(null)}
          >
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={save}
            loading={pending}
            disabled={!drafts.length}
          >
            Add {drafts.length === 1 ? "task" : `${drafts.length} tasks`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Need to finish my math worksheet, practice piano, work out, and work on my app tomorrow."
        aria-label="What's on your mind?"
        autoFocus
        className="min-h-32"
        maxLength={2000}
      />
      <p className="text-xs text-muted">
        Write it however it comes out. DayOS will split it into tasks and work
        out how long each one takes.
      </p>
      <Button
        className="w-full"
        onClick={extract}
        loading={pending}
        disabled={!text.trim()}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        Turn into tasks
      </Button>
    </div>
  );
}
