import {
  CalendarDays,
  FolderKanban,
  ListChecks,
  Sun,
  User,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
