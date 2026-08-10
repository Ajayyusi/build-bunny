"use client";

import { useEffect, useRef, useState } from "react";

export interface CountUpProps {
  /**
   * The final value to count up to. If the value changes across renders
   * (e.g. after XP is awarded), the animation restarts from the previous
   * displayed value so the tween tracks reality rather than restarting
   * from zero — a smoother "you gained 20 XP" beat.
   */
  value: number;
  /** Duration in ms. Defaults to 700ms — long enough to notice, short
   * enough to never feel like latency. */
  durationMs?: number;
  className?: string;
}

/**
 * Animates from the last-rendered value up to `value` using rAF and an
 * ease-out curve, so a student's XP/stars/streak counters visibly climb
 * when the home screen loads or when they earn more.
 *
 * SSR-safe: the initial paint renders the target value (no flash of 0),
 * then the effect resets to the previous value and tweens forward. First
 * visit shows a satisfying 0 → N climb; subsequent visits show only the
 * delta if progress changed.
 *
 * Respects prefers-reduced-motion: the effect short-circuits and paints
 * the final number immediately.
 */
export function CountUp({ value, durationMs = 700, className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const previousValue = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Detect motion preference at animation time; users can flip it mid-
    // session (Windows lets you toggle it live) and we want to react.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || value === previousValue.current) {
      setDisplay(value);
      previousValue.current = value;
      return;
    }

    const start = previousValue.current;
    const end = value;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      // Ease-out cubic: fast start, smooth arrival — matches the confident
      // easing the animate reference recommends.
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        previousValue.current = end;
        frame.current = null;
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}
