"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button, Spinner, useFocusTrap } from "@/ui";

import styles from "./player.module.css";

/**
 * The Learn step's third beat: hand off to the puzzle that needs the concept
 * (LEARN-STEP-SPEC.md §Shape). Deliberately NOT SuccessOverlay — there is no
 * star burst to run and no score to celebrate, because a lesson awards no
 * stars. What it does instead is name what was just learned and point at the
 * level where it gets used: "Now try it yourself."
 */

interface LearnDoneOverlayProps {
  /** Authored post-completion teaching copy (Level.explanation). */
  explanation: string;
  /** Server-confirmed XP for this attempt; null while saving. */
  xpAwarded: number | null;
  saving: boolean;
  saveFailed: boolean;
  onRetrySave: () => void;
  /** The puzzle this lesson leads into; null when it isn't reachable yet. */
  nextHref: string | null;
}

export function LearnDoneOverlay({
  explanation,
  xpAwarded,
  saving,
  saveFailed,
  onRetrySave,
  nextHref,
}: LearnDoneOverlayProps) {
  const t = useTranslations("student.play.learn");
  const tSuccess = useTranslations("student.play.success");
  // Same manual focus trap as IntroOverlay/SuccessOverlay — this overlay sits
  // inside the immersive player, so it can't use the top-layer <dialog>.
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("doneTitle")}
      tabIndex={-1}
      className={`${styles.overlay} absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-surface p-4 focus:outline-none`}
    >
      <div
        className={`${styles.card} flex w-full max-w-md flex-col gap-4 rounded-xl border border-border-token bg-surface-raised p-6 shadow-raised`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span aria-hidden="true" className="text-4xl">
            💡
          </span>
          <h1 className="font-display text-xl font-bold text-ink">{t("doneTitle")}</h1>
          {saving ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Spinner size="sm" /> {tSuccess("saving")}
            </p>
          ) : saveFailed ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-warning">
              {tSuccess("saveFailed")}
              <Button variant="secondary" size="lg" onClick={onRetrySave}>
                {tSuccess("saveRetry")}
              </Button>
            </p>
          ) : xpAwarded !== null && xpAwarded > 0 ? (
            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-accent/25 px-4 text-sm font-bold tabular-nums">
              <span aria-hidden="true">⚡</span>
              {tSuccess("xp", { xp: xpAwarded })}
            </span>
          ) : null}
        </div>

        {explanation ? (
          <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-4">
            <h2 className="font-display text-sm font-bold text-ink">
              {tSuccess("explanationHeading")}
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">{explanation}</p>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Link
            href="/adventure"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-token bg-surface-raised px-5 text-base font-semibold text-ink transition-colors hover:bg-surface-sunken"
          >
            {tSuccess("backToMap")}
          </Link>
          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-base font-semibold text-on-brand transition-colors hover:bg-brand-strong"
            >
              {t("tryItYourself")}
              <span aria-hidden="true" className="rtl:hidden">
                →
              </span>
              <span aria-hidden="true" className="hidden rtl:inline">
                ←
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
