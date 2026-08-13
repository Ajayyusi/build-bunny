"use client";

import { useEffect, useState } from "react";

import { BunnyMascot, cn, useReducedMotion } from "@/ui";

import { WorldBackdrop } from "./WorldBackdrop";
import styles from "./mission-intro.module.css";

export interface MissionIntroProps {
  /** World theme string — picks the environment the bunny runs into. */
  worldTheme: string;
  title: string;
  /** Fires when the run-in finishes or the student skips it. */
  onDone: () => void;
}

/** Total run-in length. Short on purpose: this plays before every level. */
const RUN_MS = 1500;

/**
 * The beat between pressing PLAY and being in the level: the world's
 * environment sweeps in, the bunny runs across it, and the level title
 * lands. Then the briefing (IntroOverlay) takes over.
 *
 * Deliberately ~1.5s and always skippable — a transition a child sees
 * dozens of times must never become a toll. Under prefers-reduced-motion it
 * does not play at all (the parent skips straight past it), so this
 * component never has to animate defensively.
 *
 * The bunny runs toward the inline-end, so it runs the reading direction in
 * both English and Arabic (BunnyMascot's `running` state mirrors itself, and
 * the track translation below is direction-aware).
 */
export function MissionIntro({ worldTheme, title, onDone }: MissionIntroProps) {
  const reducedMotion = useReducedMotion();
  const [titleIn, setTitleIn] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      onDone();
      return;
    }
    const titleTimer = window.setTimeout(() => setTitleIn(true), RUN_MS * 0.55);
    const doneTimer = window.setTimeout(onDone, RUN_MS);
    return () => {
      window.clearTimeout(titleTimer);
      window.clearTimeout(doneTimer);
    };
  }, [reducedMotion, onDone]);

  if (reducedMotion) return null;

  return (
    <div
      // Decorative and transient: the briefing dialog that follows carries
      // the accessible naming, and this cannot be interacted with beyond
      // dismissing it.
      aria-hidden="true"
      onClick={onDone}
      className={cn(
        styles.stage,
        "absolute inset-0 z-40 overflow-hidden bg-surface",
      )}
    >
      <WorldBackdrop theme={worldTheme} className={styles.backdrop} />

      <div className={styles.track}>
        <BunnyMascot state="running" size="lg" />
      </div>

      <p
        className={cn(
          styles.title,
          titleIn && styles.titleIn,
          "font-display text-2xl font-bold text-ink sm:text-3xl",
        )}
      >
        {title}
      </p>
    </div>
  );
}
