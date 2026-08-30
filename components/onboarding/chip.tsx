"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** A large, tappable multi-select chip. */
export function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-sm font-medium transition-colors",
        selected
          ? "border-accent bg-accent-soft text-accent"
          : "border-border text-muted hover:border-border-strong",
      )}
    >
      {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
      {label}
    </button>
  );
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Weekday picker used for schedules and free-time windows. */
export function DayPicker({
  value,
  onChange,
  label,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {DAY_LABELS.map((day, index) => {
        const selected = value.includes(index);
        return (
          <button
            key={index}
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={DAY_NAMES[index]}
            onClick={() =>
              onChange(
                selected
                  ? value.filter((d) => d !== index)
                  : [...value, index].sort(),
              )
            }
            className={cn(
              "h-10 w-10 rounded-full border text-sm font-medium transition-colors",
              selected
                ? "border-accent bg-accent text-accent-fg"
                : "border-border text-muted hover:border-border-strong",
            )}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}
