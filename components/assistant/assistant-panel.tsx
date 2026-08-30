"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ask, runAssistantAction } from "@/app/actions/assistant";
import { isDestructive, type AssistantAction } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils/cn";

interface Turn {
  role: "user" | "assistant";
  content: string;
  actions?: AssistantAction[];
}

const SUGGESTIONS = [
  "What should I do right now?",
  "Can I finish everything today?",
  "What am I behind on?",
  "I have one hour. What should I do?",
];

/**
 * The assistant, answering from the user's real data.
 *
 * Proposed actions are shown as buttons rather than performed silently, and
 * anything that changes or removes existing work asks once before it runs.
 */
export function AssistantPanel({
  initialQuestion,
  autoFocus = true,
}: {
  initialQuestion?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [draft, setDraft] = React.useState(initialQuestion ?? "");
  const [pending, setPending] = React.useState(false);
  const [confirming, setConfirming] = React.useState<AssistantAction | null>(
    null,
  );
  const submittedInitial = React.useRef(false);

  const send = React.useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || pending) return;

      setDraft("");
      setPending(true);
      setTurns((t) => [...t, { role: "user", content: text }]);

      const history = turns.slice(-6).map((t) => ({
        role: t.role,
        content: t.content,
      }));
      const result = await ask({ question: text, history });
      setPending(false);

      if (!result.ok) {
        setTurns((t) => [...t, { role: "assistant", content: result.error }]);
        return;
      }
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: result.data.answer,
          actions: result.data.actions,
        },
      ]);
    },
    [pending, turns],
  );

  // Run a question passed in from the command palette, once.
  React.useEffect(() => {
    if (initialQuestion && !submittedInitial.current) {
      submittedInitial.current = true;
      void send(initialQuestion);
    }
  }, [initialQuestion, send]);

  async function execute(action: AssistantAction) {
    setConfirming(null);
    const result = await runAssistantAction(action);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(result.data.message, "success");
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3">
        {turns.length === 0 && !pending ? (
          <div>
            <p className="text-sm text-muted">
              Ask about your day. I answer from your real tasks and schedule.
            </p>
            <ul className="mt-3 space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    className="w-full rounded-xl border border-border px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {turns.map((turn, i) => (
          <div
            key={i}
            className={cn(
              "animate-fade",
              turn.role === "user" ? "flex justify-end" : "",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.9375rem] leading-relaxed",
                turn.role === "user"
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-2",
              )}
            >
              {turn.content}
            </div>

            {turn.actions?.length ? (
              <ul className="mt-2 space-y-1.5">
                {turn.actions.map((action, j) => (
                  <li key={j}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() =>
                        isDestructive(action)
                          ? setConfirming(action)
                          : execute(action)
                      }
                    >
                      {describeAction(action)}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {pending ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden />
            Thinking…
          </p>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {pending ? "Thinking" : turns[turns.length - 1]?.content}
        </p>
      </div>

      {confirming ? (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning/5 p-3.5">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            {describeAction(confirming)} — confirm?
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => execute(confirming)}
            >
              Yes, do it
            </Button>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="mt-4 flex gap-2"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about your day"
          aria-label="Ask DayOS"
          autoFocus={autoFocus}
          maxLength={600}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={!draft.trim() || pending}
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

function describeAction(action: AssistantAction): string {
  switch (action.type) {
    case "createTask":
      return `Add "${action.title}"`;
    case "completeTask":
      return `Mark "${action.title}" complete`;
    case "rescheduleTask":
      return `Move "${action.title}"`;
    case "deleteTask":
      return `Delete "${action.title}"`;
    case "planDay":
      return action.instruction ? "Replan my day" : "Plan my day";
    case "breakDownProject":
      return `Break down "${action.title}"`;
  }
}
