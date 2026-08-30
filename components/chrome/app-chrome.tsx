"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { QuickCapture } from "@/components/capture/quick-capture";
import { AssignmentCapture } from "@/components/capture/assignment-capture";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { TaskForm } from "@/components/tasks/task-form";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils/cn";

type Tab = "capture" | "assignment" | "task" | "ask";

const TABS: { id: Tab; label: string }[] = [
  { id: "capture", label: "Brain dump" },
  { id: "assignment", label: "Assignment" },
  { id: "task", label: "Task" },
  { id: "ask", label: "Ask" },
];

/**
 * The floating controls present on every screen: capture (+) and the command
 * centre. Both sit above the bottom nav and inside the safe area, so they stay
 * reachable one-handed on a phone.
 */
export function AppChrome({
  timeZone,
  todayKey,
  aiEnabled,
}: {
  timeZone: string;
  todayKey: string;
  aiEnabled: boolean;
}) {
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("capture");

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openCapture() {
    setTab("capture");
    setCaptureOpen(true);
  }

  return (
    <>
      <div className="fixed right-4 bottom-20 z-30 flex flex-col items-end gap-2.5 md:bottom-6">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command centre"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/90 text-muted shadow-md backdrop-blur transition-colors hover:text-fg"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden />
          <kbd className="sr-only">Command or Control K</kbd>
        </button>

        <button
          type="button"
          onClick={openCapture}
          aria-label="Capture something"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetContent
          title="Capture"
          description="Everything you need to get out of your head."
        >
          <div
            role="tablist"
            aria-label="Capture method"
            className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-0.5"
          >
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 rounded-[9px] px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  tab === id
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "capture" ? (
            <QuickCapture onDone={() => setCaptureOpen(false)} />
          ) : null}
          {tab === "assignment" ? (
            <AssignmentCapture
              timeZone={timeZone}
              todayKey={todayKey}
              aiEnabled={aiEnabled}
              onDone={() => setCaptureOpen(false)}
            />
          ) : null}
          {tab === "task" ? (
            <TaskForm
              timeZone={timeZone}
              todayKey={todayKey}
              onDone={() => setCaptureOpen(false)}
            />
          ) : null}
          {tab === "ask" ? <AssistantPanel /> : null}
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
