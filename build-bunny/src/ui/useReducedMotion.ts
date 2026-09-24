"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const MANUAL_ATTRIBUTE = "data-motion";

function manualReduce(): boolean {
  return document.documentElement.getAttribute(MANUAL_ATTRIBUTE) === "reduce";
}

function subscribe(callback: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", callback);
  // The in-app "Reduce motion" switch sets an attribute on <html>.
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [MANUAL_ATTRIBUTE],
  });
  return () => {
    query.removeEventListener("change", callback);
    observer.disconnect();
  };
}

/**
 * Shared reduced-motion signal for JS-driven animation: true when the OS
 * asks for it OR the child switched "Reduce motion" on in Display settings.
 * The global CSS clamp in globals.css covers CSS animations for both; every
 * rAF/timer animation must consult this instead of rolling its own
 * matchMedia effect. Live-updates when either source changes mid-session;
 * SSR renders assume motion is allowed and correct on hydration.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches || manualReduce(),
    () => false,
  );
}
