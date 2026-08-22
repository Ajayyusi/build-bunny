"use client";

import { useEffect, useRef } from "react";

import type { SaveDraftAction } from "../../types";

/** Matches the Blockly players' existing 2s debounce. */
const DEBOUNCE_MS = 2000;

/**
 * Save a player's in-progress work, debounced.
 *
 * Every player already receives `draft` and `saveDraftAction`, but only the
 * Blockly players and TeachPlayer ever used them — so a child sorting
 * clusters, weighing an ethics scenario, or fitting a trend line lost the
 * lot to a sleeping tablet, a reload, or a dropped classroom wifi. On the
 * shared devices this product runs on, that is not an edge case.
 *
 * A hook rather than the effect copy-pasted a fourth time: the debounce, the
 * cleanup and the skip-the-first-render rule are easy to get subtly wrong,
 * and a player that forgets one of them fails silently.
 *
 * @param state  Serializable snapshot of the student's work. Saved as-is, so
 *               it must be JSON-safe (no Sets or Maps — spread them first).
 * @param active Pass false once the level is finished: a completed attempt
 *               should not keep overwriting the draft behind the celebration
 *               screen.
 */
export function useDraftAutosave(
  levelId: string,
  state: unknown,
  saveDraftAction: SaveDraftAction,
  active = true,
): void {
  const timerRef = useRef<number | null>(null);
  // The first render is the RESTORED draft (or the empty board). Saving it
  // straight back is a pointless write, and on a restored draft it would
  // rewrite the child's work with itself on every page load.
  const settledRef = useRef(false);
  const serialized = JSON.stringify(state ?? null);

  useEffect(() => {
    if (!settledRef.current) {
      settledRef.current = true;
      return;
    }
    if (!active) return;

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      // Fire-and-forget: a failed autosave must never interrupt play. The
      // work stays on screen and the next edit tries again.
      void saveDraftAction({ levelId, workspaceJson: JSON.parse(serialized) });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [serialized, levelId, saveDraftAction, active]);
}
