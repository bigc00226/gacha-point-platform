"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Idempotency key for a draw request. crypto.randomUUID() needs a secure context
 * (HTTPS / localhost); over plain HTTP (e.g. a LAN demo) fall back to
 * getRandomValues, which is available everywhere.
 */
export function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // fall through
    }
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Hydration-safe "now": the server value during SSR/hydration, the live clock afterwards.
// ---------------------------------------------------------------------------

const clockListeners = new Set<() => void>();
let clockTimer: number | null = null;
const CLOCK_STEP = 15_000;

function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  if (clockTimer === null) {
    clockTimer = window.setInterval(() => clockListeners.forEach((l) => l()), CLOCK_STEP);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

const clockSnapshot = () => Math.floor(Date.now() / CLOCK_STEP) * CLOCK_STEP;

/** Current time in ms, refreshed every 15 s; equals `serverNow` during hydration. */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribeClock, clockSnapshot, () => serverNow);
}

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------

/** Smoothly counts from the previous value to `target` (ease-out). */
export function useAnimatedNumber(target: number, duration = 900): number {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const from = currentRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const value = Math.round(from + (target - from) * eased);
      currentRef.current = value;
      setDisplay(value);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

// ---------------------------------------------------------------------------
// Local preferences (wrapped in try/catch: storage may be unavailable)
// ---------------------------------------------------------------------------

const SKIP_CONFIRM_KEY = "poigacha:skip-draw-confirm";
const SOUND_KEY = "poigacha:effect-sound";

export function readSkipConfirm(): boolean {
  try {
    return window.localStorage.getItem(SKIP_CONFIRM_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSkipConfirm(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(SKIP_CONFIRM_KEY, "1");
    else window.localStorage.removeItem(SKIP_CONFIRM_KEY);
  } catch {
    // ignore
  }
}

export function readSoundPref(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeSoundPref(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // ignore
  }
}
