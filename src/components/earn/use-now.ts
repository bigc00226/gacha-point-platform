"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared 1-second clock for countdowns.
 * During SSR and hydration it returns `serverNow` (so the markup matches), then the
 * browser clock takes over — no setState in effects, no hydration mismatch.
 */
let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    current = Date.now();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(serverNow: number): number {
  return useSyncExternalStore(
    subscribe,
    () => current || serverNow,
    () => serverNow,
  );
}

/** 6:12:45 → "06:12:45" (hours may exceed 24 are not expected for daily resets). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
