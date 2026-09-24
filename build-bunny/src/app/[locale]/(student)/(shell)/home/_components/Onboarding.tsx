"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { GridScene } from "@/modules/activities/players/shared/GridScene";
import { BunnyMascot, Button, cn, useFocusTrap, type BunnyState } from "@/ui";

import styles from "./onboarding.module.css";

/**
 * First-run welcome: Robo Bunny introduces itself, shows how a program is
 * made, says hints exist — and then hands the child straight into mission 1.
 *
 * It used to be four text cards ending in "Let's go!", which closed the
 * dialog and left a seven-year-old on a dashboard to work out what to press.
 * The last step's primary action is now the first mission itself; looking
 * around is the secondary choice, not the default.
 *
 * Shown only to a student who has not earned any XP yet, and dismissible for
 * good — the "seen" flag lives in localStorage rather than the database
 * because it is a per-device UI preference, not learning progress worth a
 * migration and a write path. A student on a fresh classroom tablet seeing
 * the 20-second welcome twice is a far smaller cost than a schema change.
 *
 * The key is per-user, and that is not cosmetic: this product runs on shared
 * classroom tablets, so a single global key meant the first child to dismiss
 * the welcome silently consumed it for every child who used that tablet
 * afterwards. Versioned too, so a reworked welcome is shown again (v2: the
 * three-step welcome that ends in the first mission).
 */

const STORAGE_VERSION = "v2";
const storageKey = (userId: string) => `bb:onboarded:${STORAGE_VERSION}:${userId}`;
const STEP_STATES: BunnyState[] = ["waving", "pointing", "thinking"];

interface OnboardingProps {
  show: boolean;
  userId: string;
  /** The level the child should play first; null when none is open yet. */
  firstMissionHref: string | null;
}

export function Onboarding({ show, userId, firstMissionHref }: OnboardingProps) {
  const t = useTranslations("student.home.onboarding");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useFocusTrap<HTMLDivElement>(open, step);

  useEffect(() => {
    if (!show) return;
    try {
      if (window.localStorage.getItem(storageKey(userId)) === "1") return;
    } catch {
      // Storage unavailable — show it; dismissing simply won't persist.
    }
    setOpen(true);
  }, [show, userId]);

  const markSeen = () => {
    try {
      window.localStorage.setItem(storageKey(userId), "1");
    } catch {
      // Preference won't persist; the welcome is still dismissed for now.
    }
  };

  const close = () => {
    setOpen(false);
    markSeen();
  };

  if (!open) return null;

  const last = step === STEP_STATES.length - 1;

  return (
    <div
      className={cn(
        styles.scrim,
        "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4",
      )}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        tabIndex={-1}
        className={cn(
          styles.card,
          "flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border-token bg-surface-raised p-6 text-center shadow-overlay focus:outline-none",
        )}
      >
        {step === 1 ? (
          // "Blocks, then Run, then the bunny moves" is the one idea a
          // sentence cannot teach, so this step shows it happening.
          <div className="w-full rounded-xl bg-surface-sunken p-3">
            <GridScene />
          </div>
        ) : (
          <BunnyMascot state={STEP_STATES[step]!} size="lg" />
        )}
        <h2 className="font-display text-xl font-bold text-ink">
          {t(`steps.${step}.title`)}
        </h2>
        <p className="text-base leading-relaxed text-ink-muted">
          {t(`steps.${step}.body`)}
        </p>

        <div aria-hidden="true" className="flex items-center gap-1.5">
          {STEP_STATES.map((_, index) => (
            <span
              key={index}
              className={cn(
                "size-2 rounded-full transition-colors",
                index === step ? "bg-brand" : "bg-border-token",
              )}
            />
          ))}
        </div>

        {last ? (
          <div className="flex w-full flex-col gap-2 pt-1">
            {firstMissionHref ? (
              <Link
                href={firstMissionHref}
                onClick={markSeen}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-base font-bold text-on-brand transition-colors hover:bg-brand-strong"
              >
                <span aria-hidden="true">▶</span>
                {t("done")}
              </Link>
            ) : null}
            <Button
              variant={firstMissionHref ? "ghost" : "primary"}
              size="lg"
              onClick={close}
            >
              {firstMissionHref ? t("later") : t("letsGo")}
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="lg" onClick={close}>
              {t("skip")}
            </Button>
            <Button size="lg" data-autofocus onClick={() => setStep(step + 1)}>
              {t("next")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
