"use client";

import * as React from "react";

/**
 * The current time, as an external store.
 *
 * The wall clock isn't React state — it changes on its own. Modelling it with
 * `useSyncExternalStore` keeps the snapshot stable within a render, avoids a
 * hydration mismatch (the server snapshot is passed in), and means no
 * component has to call `Date.now()` while rendering.
 */

type Listener = () => void;

class Clock {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshot = 0;

  constructor(private readonly intervalMs: number) {}

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    if (!this.timer) {
      this.snapshot = Date.now();
      this.timer = setInterval(() => {
        this.snapshot = Date.now();
        for (const l of this.listeners) l();
      }, this.intervalMs);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  };

  getSnapshot = () => {
    if (this.snapshot === 0) this.snapshot = Date.now();
    return this.snapshot;
  };
}

const clocks = new Map<number, Clock>();

function clockFor(intervalMs: number): Clock {
  let clock = clocks.get(intervalMs);
  if (!clock) {
    clock = new Clock(intervalMs);
    clocks.set(intervalMs, clock);
  }
  return clock;
}

/**
 * Milliseconds since the epoch, refreshed every `intervalMs`.
 *
 * `serverNowMs` is the value rendered on the server, so the first client
 * render matches the markup it hydrates.
 */
export function useNowMs(intervalMs: number, serverNowMs: number): number {
  const clock = React.useMemo(() => clockFor(intervalMs), [intervalMs]);
  return React.useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    () => serverNowMs,
  );
}

/** As `useNowMs`, but as a `Date`. */
export function useNow(intervalMs: number, serverNowMs: number): Date {
  const ms = useNowMs(intervalMs, serverNowMs);
  return React.useMemo(() => new Date(ms), [ms]);
}
