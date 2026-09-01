"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button, cn, useFocusTrap } from "@/ui";

export interface WalkthroughBeat {
  title: string;
  body: string;
}

interface WalkthroughProps {
  /** Already resolved to the reading locale — one idea per beat, 3-4 of them. */
  beats: WalkthroughBeat[];
  /** 1-based beat to show. 0 (or less) renders nothing. */
  step: number;
  onStep: (step: number) => void;
  /** Skipped, or walked to the end. Parents set their step back to 0. */
  onDone: () => void;
  /** The animation for this beat. Given the 1-based step. */
  renderScene: (step: number) => ReactNode;
}

/**
 * The "here is how this game works" overlay: an animation, one idea named
 * under it, and a way out at every beat.
 *
 * This shipped three times over — once in Teach the Bunny, once in Group the
 * Berries, once in the AI Lab — with the same anatomy and cosmetic drift
 * between the copies (different dot sizes, different button variants). None
 * of the three trapped focus, so a keyboard or screen-reader user could tab
 * straight out of a modal covering the whole screen and land on the
 * workspace behind it, which is exactly the thing the overlay exists to
 * withhold until the child has been shown what to do.
 *
 * One copy now, focus-trapped and Escape-dismissable, so that adding a
 * walkthrough to another activity is authoring a scene and some beats rather
 * than pasting the chrome a fourth time.
 */
export function Walkthrough({ beats, step, onStep, onDone, renderScene }: WalkthroughProps) {
  const t = useTranslations("student.play.walkthrough");
  const stepCount = beats.length;
  const active = step > 0 && step <= stepCount;

  // resetKey=step moves focus back to the first control as each beat lands,
  // so "Next" stays under the keyboard rather than drifting.
  const dialogRef = useFocusTrap<HTMLDivElement>(active, step);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onDone]);

  if (!active) return null;
  const beat = beats[step - 1]!;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={beat.title}
        tabIndex={-1}
        className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-surface-raised p-6 shadow-overlay focus:outline-none"
      >
        {renderScene(step)}
        {/* The scene carries the meaning; announcing the words as they change
            is what a child who cannot see it gets instead. */}
        <div aria-live="polite">
          <h2 className="font-display text-xl font-bold text-ink">{beat.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{beat.body}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-1.5"
            aria-label={t("stepLabel", { step, total: stepCount })}
          >
            {Array.from({ length: stepCount }, (_, i) => i + 1).map((n) => (
              <span
                key={n}
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full transition-colors",
                  n === step ? "bg-brand" : "bg-ink/15",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onDone}>
              {t("skip")}
            </Button>
            <Button onClick={() => (step >= stepCount ? onDone() : onStep(step + 1))}>
              {step >= stepCount ? t("start") : t("next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
