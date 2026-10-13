"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false during SSR and hydration, true afterwards (no setState-in-effect). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** The themed portal container rendered by each layout (falls back to <body>). */
export function getPortalRoot(): HTMLElement {
  return document.getElementById("app-portal") ?? document.body;
}
