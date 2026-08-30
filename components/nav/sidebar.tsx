"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Target, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav-items";

const SECONDARY = [
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/review", label: "Review", icon: Sparkles },
] as const;

/** Desktop navigation — the same destinations, laid out as a rail. */
export function Sidebar() {
  const pathname = usePathname();

  const link = (
    href: string,
    label: string,
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>,
  ) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-accent-soft text-accent"
              : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
          {label}
        </Link>
      </li>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
      <Link href="/today" className="mb-8 px-2">
        <Wordmark />
      </Link>

      <nav aria-label="Primary" className="flex-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map((i) => link(i.href, i.label, i.icon))}
        </ul>
        <p className="mt-6 mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
          More
        </p>
        <ul className="space-y-1">
          {SECONDARY.map((i) => link(i.href, i.label, i.icon))}
        </ul>
      </nav>
    </aside>
  );
}
