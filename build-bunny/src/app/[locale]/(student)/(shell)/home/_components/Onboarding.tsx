"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { BunnyMascot, Button, cn, useFocusTrap, type BunnyState } from "@/ui";

import styles from "./onboarding.module.css";

/**
 * First-run welcome: Bunny introduces itself and the four things a student
 * needs to know (the map, missions, XP/stars, and that hints exist).
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
 * afterwards. Versioned too, so a reworked welcome can be shown again.
 */

const STORAGE_VERSION = "v1";
const storageKey = (userId: string) => `bb:onboarded:${STORAGE_VERSION}:${userId}`;
const STEP_STATES: BunnyState[] = ["waving", "pointing", "excited", "thinking"];

export function Onboarding({ show, userId }: { show: boolean; userId: string }) {
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

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey(userId), "1");
    } catch {
      // Preference won't persist; the welcome is still dismissed for now.
    }
  };

  if (!open) return null;

  const last = step === STEP_STATES.length - 1;

  return (
    <div
      className={cn(
        styles.scrim,
        "fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4",
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
        <BunnyMascot state={STEP_STATES[step]!} size="lg" />
        <h2 className="font-display text-xl font-bold text-ink">
          {t(`steps.${step}.title`)}
        </h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t(`steps.${step}.body`)}
        </p>

        <div aria-hidden="true" className="flex items-center gap-1.5">
          {STEP_STATES.map((_, index) => (
            <span
              key={index}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                index === step ? "bg-brand" : "bg-border-token",
              )}
            />
          ))}
        </div>

        <div className="flex w-full items-center justify-between gap-2 pt-1">
          <Button variant="ghost" size="lg" onClick={close}>
            {t("skip")}
          </Button>
          <Button size="lg" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? t("done") : t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
