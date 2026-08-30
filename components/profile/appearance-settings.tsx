"use client";

import * as React from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  ACCENTS,
  ACCENT_KEY,
  ACCENT_SWATCH,
  APPEARANCE_EVENT,
  DEFAULT_ACCENT,
  DEFAULT_TEXT,
  TEXT_KEY,
  TEXT_SIZES,
  THEME_KEY,
  applyAppearance,
  isAccent,
  isTextSize,
  isTheme,
  readStored,
  type Accent,
  type TextSize,
  type Theme,
} from "@/lib/appearance";
import { cn } from "@/lib/utils/cn";

/**
 * Appearance: theme, accent scheme and text size.
 *
 * All three are per-device and stored in `localStorage`, which is an external
 * store rather than React state — so a change in one tab is reflected in
 * another, and rendering never reads storage mid-render.
 */

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(APPEARANCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(APPEARANCE_EVENT, onChange);
  };
}

const readTheme = () => readStored<Theme>(THEME_KEY, isTheme, "system");
const readAccent = () => readStored<Accent>(ACCENT_KEY, isAccent, DEFAULT_ACCENT);
const readText = () => readStored<TextSize>(TEXT_KEY, isTextSize, DEFAULT_TEXT);

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function AppearanceSettings() {
  const theme = React.useSyncExternalStore(
    subscribe,
    readTheme,
    () => "system" as Theme,
  );
  const accent = React.useSyncExternalStore(
    subscribe,
    readAccent,
    () => DEFAULT_ACCENT,
  );
  const textSize = React.useSyncExternalStore(
    subscribe,
    readText,
    () => DEFAULT_TEXT,
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-muted">Theme</p>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex rounded-xl border border-border bg-surface p-0.5"
        >
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={theme === value}
              onClick={() => applyAppearance({ theme: value })}
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
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted">Accent colour</p>
        <div
          role="radiogroup"
          aria-label="Accent colour"
          className="flex flex-wrap gap-2 sm:gap-2.5"
        >
          {ACCENTS.map(({ value, label }) => {
            const selected = accent === value;
            return (
              <button
                key={value}
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                onClick={() => applyAppearance({ accent: value })}
                className={cn(
                  // Sized so all seven fit one row on a small phone.
                  "flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 sm:h-10 sm:w-10",
                  selected
                    ? "ring-2 ring-offset-2 ring-offset-[var(--color-surface)]"
                    : "hover:scale-105",
                )}
                style={{
                  backgroundColor: ACCENT_SWATCH[value],
                  // Ring in the swatch's own colour, so selection reads even
                  // when the chosen accent isn't the current one.
                  ...(selected
                    ? ({ "--tw-ring-color": ACCENT_SWATCH[value] } as React.CSSProperties)
                    : {}),
                }}
              >
                {selected ? (
                  <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-faint">
          Only buttons and highlights change. Priority and category colours stay
          the same, so nothing loses its meaning.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted">Text size</p>
        <div
          role="radiogroup"
          aria-label="Text size"
          className="flex rounded-xl border border-border bg-surface p-0.5"
        >
          {TEXT_SIZES.map(({ value, label, sample }, index) => (
            <button
              key={value}
              role="radio"
              aria-checked={textSize === value}
              onClick={() => applyAppearance({ text: value })}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-[9px] px-3 py-2 transition-colors",
                textSize === value
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted",
              )}
            >
              <span
                aria-hidden
                style={{ fontSize: [13, 15, 17][index] }}
                className="font-semibold"
              >
                {sample}
              </span>
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">
          Scales the whole interface, not just the words — buttons and spacing
          grow with the text.
        </p>
      </div>
    </div>
  );
}
