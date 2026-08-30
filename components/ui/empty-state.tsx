import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Empty states are part of the product, not a fallback: each one says what the
 * section is for and offers the next action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <Icon className="mb-3 h-6 w-6 text-faint" aria-hidden />
      ) : null}
      <p className="text-[0.9375rem] font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
