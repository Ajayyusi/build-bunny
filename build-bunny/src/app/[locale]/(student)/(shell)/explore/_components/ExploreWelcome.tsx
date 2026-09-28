"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { BunnyMascot, Button, cn, useFocusTrap } from "@/ui";

import styles from "./welcome.module.css";

/**
 * First-run welcome on Explore AI, the student landing (redesign brief's
 * first session): Robo Bunny asks "Can you teach a robot to sort shapes?"
 * and the primary action IS the first activity, Train a Sorter — not a tour
 * that ends on a dashboard. Looking around is the secondary choice.
 *
 * Shown to a student who has not finished anything yet. The "seen" flag is
 * per user and per device (shared classroom tablets), in localStorage: a
 * UI preference, not learning progress.
 */

const storageKey = (userId: string) => `bb:welcome:ai:v1:${userId}`;

interface Props {
  show: boolean;
  userId: string;
  /** The first AI activity; null when it isn't in this child's programme. */
  firstActivityHref: string | null;
}

export function ExploreWelcome({ show, userId, firstActivityHref }: Props) {
  const t = useTranslations("student.explore.welcome");
  const [open, setOpen] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(open, 0);

  useEffect(() => {
    if (!show) return;
    try {
      if (window.localStorage.getItem(storageKey(userId)) === "1") return;
    } catch {
      // Storage unavailable: show it; dismissing simply won't persist.
    }
    setOpen(true);
  }, [show, userId]);

  const markSeen = () => {
    try {
      window.localStorage.setItem(storageKey(userId), "1");
    } catch {
      // The preference won't persist; it is still dismissed for now.
    }
  };

  const close = () => {
    setOpen(false);
    markSeen();
  };

  if (!open) return null;

  return (
    <div className={cn(styles.scrim, "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4")}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explore-welcome-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className={cn(
          styles.card,
          "flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border-token bg-surface-raised p-6 text-center shadow-overlay focus:outline-none",
        )}
      >
        <BunnyMascot state="waving" size="lg" />
        <h2 id="explore-welcome-title" className="font-display text-xl font-bold text-ink">
          {t("title")}
        </h2>
        <p className="text-base leading-relaxed text-ink-muted">{t("body")}</p>
        <div className="flex w-full flex-col gap-2 pt-1">
          {firstActivityHref ? (
            <Link
              href={firstActivityHref}
              onClick={markSeen}
              data-autofocus
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-base font-bold text-on-brand transition-colors hover:bg-brand-strong"
            >
              <span aria-hidden="true">▶</span>
              {t("start")}
            </Link>
          ) : null}
          <Button variant={firstActivityHref ? "ghost" : "primary"} size="lg" onClick={close}>
            {t("later")}
          </Button>
        </div>
      </div>
    </div>
  );
}
