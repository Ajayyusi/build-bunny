"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button, Spinner, cn, useFocusTrap } from "@/ui";

import styles from "./player.module.css";

/**
 * The celebration beat: a short star burst (skippable, skipped entirely
 * under reduced motion), then the explanation card with the authored
 * teaching copy and the onward actions. Stars/XP always reflect the server
 * verdict once it lands; until then the card shows a quiet saving state.
 * Shared across every activity engine's player (m4 task 4).
 */

export interface SuccessAchievement {
  slug: string;
  icon: string;
  name: string;
}

interface SuccessOverlayProps {
  stars: number;
  maxStars: number;
  /** Server-confirmed XP for this attempt; null while saving. */
  xpAwarded: number | null;
  explanation: string;
  achievements: SuccessAchievement[];
  worldCompletedName: string | null;
  gradeMismatch: boolean;
  saving: boolean;
  saveFailed: boolean;
  onRetrySave: () => void;
  /** "For more stars" note when the pass wasn't perfect. */
  improveNote: string | null;
  nextHref: string | null;
  reducedMotion: boolean;
}

const BURST_MS = 2200;

export function SuccessOverlay({
  stars,
  maxStars,
  xpAwarded,
  explanation,
  achievements,
  worldCompletedName,
  gradeMismatch,
  saving,
  saveFailed,
  onRetrySave,
  improveNote,
  nextHref,
  reducedMotion,
}: SuccessOverlayProps) {
  const t = useTranslations("student.play.success");
  const [stage, setStage] = useState<"burst" | "card">(
    reducedMotion ? "card" : "burst",
  );

  useEffect(() => {
    if (stage !== "burst") return;
    const timer = window.setTimeout(() => setStage("card"), BURST_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  // Same manual trap as IntroOverlay (this overlay can't use the native
  // <dialog>-based Dialog component — see its comment). resetKey=stage
  // re-focuses when the burst gives way to the explanation card, since that
  // swaps the whole role="dialog" subtree in place.
  const dialogRef = useFocusTrap<HTMLDivElement>(true, stage);

  const starsRow = (size: string) => (
    <span
      role="img"
      aria-label={t("starsSr", { stars, maxStars })}
      className="flex items-center justify-center gap-2"
    >
      {Array.from({ length: maxStars }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            size,
            "leading-none",
            index < stars ? "text-accent" : "text-ink-faint",
            stage === "burst" &&
              (index < stars ? styles.burstStar : styles.burstStarDim),
          )}
          style={{ "--pop-delay": `${200 + index * 380}ms` } as React.CSSProperties}
        >
          ★
        </span>
      ))}
    </span>
  );

  if (stage === "burst") {
    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        tabIndex={-1}
        className={`${styles.overlay} absolute inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-surface p-6 focus:outline-none`}
      >
        <p className="font-display text-2xl font-bold text-ink">{t("title")}</p>
        {starsRow("text-6xl")}
        <Button variant="ghost" size="lg" onClick={() => setStage("card")}>
          {t("skip")}
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      tabIndex={-1}
      className={`${styles.overlay} absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-surface p-4 focus:outline-none`}
    >
      <div
        className={`${styles.card} flex w-full max-w-md flex-col gap-4 rounded-xl border border-border-token bg-surface-raised p-6 shadow-raised`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-xl font-bold text-ink">
            {t("title")}
          </h1>
          {starsRow("text-4xl")}
          {saving ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Spinner size="sm" /> {t("saving")}
            </p>
          ) : saveFailed ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-warning">
              {t("saveFailed")}
              <Button variant="secondary" size="sm" onClick={onRetrySave}>
                {t("saveRetry")}
              </Button>
            </p>
          ) : xpAwarded !== null && xpAwarded > 0 ? (
            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-accent/25 px-4 text-sm font-bold tabular-nums">
              <span aria-hidden="true">⚡</span>
              {t("xp", { xp: xpAwarded })}
            </span>
          ) : null}
          {gradeMismatch ? (
            <p className="text-xs text-ink-muted">{t("gradeMismatchNote")}</p>
          ) : null}
        </div>

        {explanation ? (
          <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-4">
            <h2 className="font-display text-sm font-bold text-ink">
              {t("explanationHeading")}
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              {explanation}
            </p>
          </div>
        ) : null}

        {improveNote ? (
          <div className="flex items-start gap-2 rounded-lg border border-border-token p-3">
            <span aria-hidden="true">⭐</span>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {t("improveHeading")}
              </h2>
              <p className="text-sm leading-relaxed text-ink">{improveNote}</p>
            </div>
          </div>
        ) : null}

        {achievements.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t("achievementsHeading")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {achievements.map((achievement) => (
                <li
                  key={achievement.slug}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-token bg-surface-sunken px-3 text-sm font-semibold"
                >
                  <span aria-hidden="true">{achievement.icon}</span>
                  {achievement.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {worldCompletedName ? (
          <p className="text-center text-sm font-bold text-brand">
            {t("worldCompleted", { world: worldCompletedName })}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Link
            href="/adventure"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-token bg-surface-raised px-5 text-base font-semibold text-ink transition-colors hover:bg-surface-sunken"
          >
            {t("backToMap")}
          </Link>
          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-base font-semibold text-on-brand transition-colors hover:bg-brand-strong"
            >
              {t("next")}
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
