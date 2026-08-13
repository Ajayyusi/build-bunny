"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/**
 * Shared prefers-reduced-motion signal for JS-driven animation. The global
 * CSS clamp in globals.css only covers CSS animations — every rAF/timer
 * animation must consult this instead of rolling its own matchMedia effect
 * (the pre-hook convention this replaces). Live-updates when the user flips
 * the OS setting mid-session; SSR renders assume motion is allowed and
 * correct on hydration.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
