"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FolderKanban,
  ListChecks,
  Search,
  Sparkles,
  Sun,
  Target,
  User,
  Zap,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { useToast } from "@/components/ui/toast";
import { planDay } from "@/app/actions/plan";
import { cn } from "@/lib/utils/cn";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void | Promise<void>;
  keywords: string;
}

/**
 * The command centre.
 *
 * ⌘K on desktop, the search control on mobile. Anything that isn't a known
 * command is treated as a question and handed to the assistant, so the user
 * never has to know which is which.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [askingWith, setAskingWith] = React.useState<string | null>(null);
  const [planning, setPlanning] = React.useState(false);

  function close() {
    setQuery("");
    setAskingWith(null);
    onOpenChange(false);
  }

  const go = React.useCallback(
    (href: string) => () => {
      close();
      router.push(href);
    },
    // `close` is stable enough for this: it only touches setState + the prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  );

  const commands = React.useMemo<Command[]>(
    () => [
      {
        id: "plan",
        label: "Plan my day",
        hint: "Build today's schedule",
        icon: Zap,
        keywords: "plan schedule day build",
        run: async () => {
          setPlanning(true);
          const result = await planDay({});
          setPlanning(false);
          if (!result.ok) {
            toast(result.error, "error");
            return;
          }
          toast(result.data.summary, "success");
          close();
          router.refresh();
        },
      },
      { id: "today", label: "Today", icon: Sun, keywords: "today now schedule", run: go("/today") },
      { id: "tasks", label: "Tasks", icon: ListChecks, keywords: "tasks todo list", run: go("/tasks") },
      { id: "plan-view", label: "Plan", icon: CalendarDays, keywords: "plan calendar week", run: go("/plan") },
      { id: "projects", label: "Projects", icon: FolderKanban, keywords: "projects", run: go("/projects") },
      { id: "goals", label: "Goals", icon: Target, keywords: "goals", run: go("/goals") },
      { id: "review", label: "Review", icon: Sparkles, keywords: "review weekly daily stats", run: go("/review") },
      { id: "profile", label: "Profile", icon: User, keywords: "profile settings preferences", run: go("/profile") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [go, router, toast],
  );

  const trimmed = query.trim();
  const matches = React.useMemo(() => {
    if (!trimmed) return commands;
    const q = trimmed.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || c.keywords.includes(q.split(" ")[0]),
    );
  }, [commands, trimmed]);

  // A phrase that no command matches is a question, not a typo.
  const looksLikeQuestion =
    trimmed.length > 0 && (matches.length === 0 || trimmed.split(/\s+/).length >= 3);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (looksLikeQuestion) {
      setAskingWith(trimmed);
      return;
    }
    void matches[0]?.run();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <SheetContent
        title={askingWith ? "DayOS" : "Command centre"}
        description={
          askingWith ? undefined : "Jump somewhere, run something, or just ask."
        }
        className="sm:max-w-lg"
      >
        {askingWith ? (
          <AssistantPanel initialQuestion={askingWith} />
        ) : (
          <>
            <form onSubmit={onSubmit}>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Add piano practice tomorrow at 6, or ask anything"
                  aria-label="Command or question"
                  autoFocus
                  className="pl-9"
                  maxLength={600}
                />
              </div>
            </form>

            <ul className="mt-3 space-y-1">
              {looksLikeQuestion ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setAskingWith(trimmed)}
                    className="flex w-full items-center gap-3 rounded-xl bg-accent-soft px-3.5 py-3 text-left"
                  >
                    <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-medium">
                        Ask DayOS
                      </span>
                      <span className="block truncate text-xs text-muted">
                        &ldquo;{trimmed}&rdquo;
                      </span>
                    </span>
                  </button>
                </li>
              ) : null}

              {matches.map((command) => (
                <li key={command.id}>
                  <button
                    type="button"
                    onClick={() => void command.run()}
                    disabled={command.id === "plan" && planning}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-surface-2",
                      "disabled:opacity-60",
                    )}
                  >
                    <command.icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-medium">
                        {command.label}
                      </span>
                      {command.hint ? (
                        <span className="block text-xs text-muted">
                          {command.id === "plan" && planning
                            ? "Planning…"
                            : command.hint}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
