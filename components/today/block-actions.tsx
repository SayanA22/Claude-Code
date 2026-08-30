"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, SkipForward, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { completeBlock, skipBlock } from "@/app/actions/schedule";
import { postponeTask } from "@/app/actions/tasks";
import { replanRestOfDay } from "@/app/actions/plan";
import type { ScheduleBlockWithTask } from "@/types/db";

/**
 * "I can't do this right now."
 *
 * Four ways out, so the honest answer is always one tap away and the schedule
 * stays true instead of quietly rotting.
 */
export function BlockActionsSheet({
  block,
  open,
  onOpenChange,
}: {
  block: ScheduleBlockWithTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [askingAi, setAskingAi] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");

  // Reset on close in the event handler rather than an effect, so the sheet
  // never renders a stale state for a frame.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setAskingAi(false);
      setInstruction("");
    }
    onOpenChange(next);
  }

  if (!block) return null;

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(key);
    const result = await fn();
    setPending(null);
    if (!result.ok) {
      toast(result.error ?? "Something went wrong.", "error");
      return;
    }
    handleOpenChange(false);
    router.refresh();
  }

  const current = block;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        title={current.title}
        description="What do you want to do with this session?"
      >
        {askingAi ? (
          <div className="space-y-3">
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="I only have 30 minutes now."
              aria-label="Tell DayOS what changed"
              autoFocus
              maxLength={400}
            />
            <p className="text-xs text-muted">
              DayOS will rebuild the rest of today around this. Finished work
              stays where it is.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setAskingAi(false)}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                loading={pending === "ai"}
                disabled={!instruction.trim()}
                onClick={() =>
                  run("ai", async () => {
                    const result = await replanRestOfDay(instruction.trim());
                    if (result.ok) toast(result.data.summary);
                    return result;
                  })
                }
              >
                Replan my day
              </Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            <ActionRow
              icon={Check}
              label="Mark complete"
              hint="I already finished this."
              loading={pending === "complete"}
              onClick={() =>
                run("complete", () => completeBlock({ blockId: current.id }))
              }
            />
            <ActionRow
              icon={CalendarClock}
              label="Move to tomorrow"
              hint="Keep it, just not today."
              loading={pending === "postpone"}
              disabled={!current.task_id}
              onClick={() =>
                run("postpone", async () => {
                  const result = await postponeTask({
                    id: current.task_id as string,
                    days: 1,
                  });
                  return result;
                })
              }
            />
            <ActionRow
              icon={SkipForward}
              label="Skip this session"
              hint="Drop it from today's plan."
              loading={pending === "skip"}
              onClick={() => run("skip", () => skipBlock(current.id))}
            />
            <ActionRow
              icon={Sparkles}
              label="Ask DayOS"
              hint="Tell it what changed and let it rebuild the day."
              onClick={() => setAskingAi(true)}
            />
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ActionRow({
  icon: Icon,
  label,
  hint,
  onClick,
  loading,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={loading || disabled}
        className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        <Icon className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[0.9375rem] font-medium">{label}</span>
          <span className="block text-xs text-muted">{hint}</span>
        </span>
        {loading ? (
          <span className="ml-auto text-xs text-muted">Working…</span>
        ) : null}
      </button>
    </li>
  );
}
