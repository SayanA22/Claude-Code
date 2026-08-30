import * as React from "react";
import { cn } from "@/lib/utils/cn";
import type { TaskPriority } from "@/types/db";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        "bg-surface-2 text-muted",
        className,
      )}
      {...props}
    />
  );
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  critical: "text-danger",
  high: "text-warning",
  medium: "text-muted",
  low: "text-faint",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Priority is conveyed by a label plus a dot — never by color alone, so it
 * still reads for color-blind users and in monochrome.
 */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  return (
    <Badge className={cn(PRIORITY_STYLE[priority], "bg-transparent", className)}>
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
      />
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}
