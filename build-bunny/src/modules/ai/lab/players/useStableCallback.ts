"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a ref pointed at the latest version of a callback prop and returns a
 * function whose IDENTITY never changes across renders. The three AI_SIM
 * widgets report the child's live work upward on every drag tick via a
 * `useEffect`/event handler that must not (a) re-run just because the parent
 * re-rendered with a fresh callback identity, or (b) risk a stale closure by
 * being omitted from a dependency array. Neither `onWorkChange` from the
 * wrapper nor any consumer of this hook is assumed to be memoized.
 */
export function useStableCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });
  const stableRef = useRef((...args: Args) => callbackRef.current(...args));
  return stableRef.current;
}
