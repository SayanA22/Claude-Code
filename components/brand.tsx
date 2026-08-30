import { cn } from "@/lib/utils/cn";

/** The DayOS mark — a focus ring with a single marker. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-7 w-7", className)}
      aria-hidden
      fill="none"
    >
      <circle
        cx="16"
        cy="16"
        r="10.5"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeDasharray="52 14"
        strokeDashoffset="-19"
        strokeLinecap="round"
      />
      <circle cx="16" cy="5.5" r="3.6" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className="h-6 w-6 text-accent" />
      <span className="text-lg font-semibold tracking-tight">DayOS</span>
    </span>
  );
}
