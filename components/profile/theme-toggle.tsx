"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const STORAGE_KEY = "dayos-theme";
const CHANGE_EVENT = "dayos-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * Theme choice, stored per device.
 *
 * The stored value is an external store rather than component state, so it
 * stays correct across tabs. The root layout applies it before first paint, so
 * switching here never causes a flash on the next load.
 */
export function ThemeToggle() {
  const theme = React.useSyncExternalStore(
    subscribe,
    readTheme,
    () => "system" as Theme,
  );

  function apply(next: Theme) {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the change still applies for this session.
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle(
      "dark",
      next === "dark" || (next === "system" && prefersDark),
    );
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex rounded-xl border border-border bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          onClick={() => apply(value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 py-2 text-sm transition-colors",
            theme === value
              ? "bg-accent-soft font-medium text-accent"
              : "text-muted",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
