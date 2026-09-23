"use client";

import { useCallback } from "react";

import type { EngineEvent } from "@/engine";
import { useSound } from "@/ui";

/**
 * Sound for the grid players (block coding, debugging, Learn steps): a
 * wooden "tock" when a block snaps on, a soft hop per move, a swish per
 * turn, a sparkle on collect, a round "bonk" on a rock, a splash in water.
 * Every call is a no-op unless the child has turned sound effects on, and
 * the provider rate-limits repeats so a fast playback never buzzes.
 */
export function useGridSounds() {
  const { play } = useSound();

  const onEvent = useCallback(
    (event: EngineEvent) => {
      switch (event.type) {
        case "move":
          play("hop");
          break;
        case "turn":
          play("turn");
          break;
        case "collect":
          play("collect");
          break;
        case "bump":
          play("bump");
          break;
        case "splash":
          play("splash");
          break;
        case "collectFail":
        case "budgetExceeded":
          play("oops");
          break;
        default:
          break;
      }
    },
    [play],
  );

  const onBlockGesture = useCallback(
    (kind: "place" | "remove") => play(kind),
    [play],
  );

  return { onEvent, onBlockGesture, play };
}
