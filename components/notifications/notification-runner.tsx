"use client";

import * as React from "react";
import {
  computeNotifications,
  type PlannedNotification,
} from "@/lib/notifications/schedule";
import type { NotificationPrefs, ScheduleBlockWithTask, Task } from "@/types/db";

/**
 * Delivers the notifications `computeNotifications` planned, while the app is
 * open or installed as a PWA.
 *
 * This is the browser-side half of the notification architecture. It never
 * asks for permission on its own — the user turns notifications on in
 * Settings, and that grant is what triggers the prompt. Anything already
 * delivered is remembered per device, so reopening the app doesn't repeat it.
 *
 * A push service (or a native client) can replace this transport without
 * touching the scheduling logic.
 */

const SENT_KEY = "dayos-sent-notifications";
/** Only schedule timers for the next hour; longer waits belong to push. */
const HORIZON_MS = 60 * 60_000;

export function NotificationRunner({
  blocks,
  tasks,
  prefs,
  timeZone,
  serverNow,
}: {
  blocks: ScheduleBlockWithTask[];
  tasks: Task[];
  prefs: NotificationPrefs;
  timeZone: string;
  serverNow: string;
}) {
  React.useEffect(() => {
    if (!prefs?.enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const planned = computeNotifications({
      blocks,
      tasks,
      prefs,
      now: new Date(serverNow),
      timeZone,
    });

    const sent = readSent();
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const item of planned) {
      const delay = item.at.getTime() - Date.now();
      if (delay <= 0 || delay > HORIZON_MS) continue;
      if (sent.has(item.id)) continue;

      timers.push(
        setTimeout(() => {
          deliver(item);
          markSent(item.id);
        }, delay),
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [blocks, tasks, prefs, timeZone, serverNow]);

  return null;
}

function deliver(item: PlannedNotification) {
  try {
    const notification = new Notification(item.title, {
      body: item.body,
      tag: item.id,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = item.href;
    };
  } catch {
    // Notification construction throws in some embedded browsers; a missed
    // reminder is not worth breaking the page over.
  }
}

function readSent(): Set<string> {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { id: string; at: number }[];
    const cutoff = Date.now() - 36 * 3_600_000;
    return new Set(parsed.filter((e) => e.at > cutoff).map((e) => e.id));
  } catch {
    return new Set();
  }
}

function markSent(id: string) {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as { id: string; at: number }[]) : [];
    const cutoff = Date.now() - 36 * 3_600_000;
    const next = [
      ...parsed.filter((e) => e.at > cutoff),
      { id, at: Date.now() },
    ];
    localStorage.setItem(SENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); at worst a repeat reminder.
  }
}
