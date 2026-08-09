"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, Dialog, Spinner, cn } from "@/ui";

/**
 * Progressive hint tiers (m3 contract): tier 1 is free; each next tier
 * unlocks after another run OR a 60s cooldown from the previous reveal.
 * Revealed hints stay visible for the whole session; tiers 3–4 carry the
 * star-cap warning so the trade-off is honest up front. Shared across every
 * activity engine's player (m4 task 4).
 */

export interface HintTierState {
  tier: number;
  revealed: boolean;
  /** Resolved display text; null until (re)fetched from the server. */
  text: string | null;
  /** Reveal timestamp this session; 0 = revealed in an earlier session. */
  revealedAt: number;
  error: boolean;
}

type TierAccess =
  | { kind: "open" }
  | { kind: "lockedPrevious" }
  | { kind: "cooldown"; remainingMs: number };

function accessFor(
  tier: HintTierState,
  previous: HintTierState | undefined,
  lastRunAt: number | null,
  now: number,
): TierAccess {
  if (tier.revealed || tier.tier === 1 || !previous) return { kind: "open" };
  if (!previous.revealed) return { kind: "lockedPrevious" };
  // Earlier-session reveals have long satisfied the cooldown.
  if (previous.revealedAt === 0) return { kind: "open" };
  if (lastRunAt !== null && lastRunAt > previous.revealedAt) return { kind: "open" };
  const remainingMs = 60_000 - (now - previous.revealedAt);
  if (remainingMs <= 0) return { kind: "open" };
  return { kind: "cooldown", remainingMs };
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface HintDrawerProps {
  open: boolean;
  onClose: () => void;
  hints: HintTierState[];
  /** Timestamp of the latest Run — unlocks the next tier without waiting. */
  lastRunAt: number | null;
  revealingTier: number | null;
  onReveal: (tier: number) => void;
}

export function HintDrawer({
  open,
  onClose,
  hints,
  lastRunAt,
  revealingTier,
  onReveal,
}: HintDrawerProps) {
  const t = useTranslations("student.play.hints");
  const [now, setNow] = useState(() => Date.now());

  // Tick only while a countdown is actually visible.
  const hasCooldown = hints.some(
    (hint) =>
      accessFor(hint, hints[hint.tier - 2], lastRunAt, now).kind === "cooldown",
  );
  useEffect(() => {
    if (!open || !hasCooldown) return;
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [open, hasCooldown]);
  useEffect(() => {
    if (open) setNow(Date.now());
  }, [open]);

  if (!open) return null;

  return (
    <Dialog open onClose={onClose} title={t("title")} closeLabel={t("close")}>
      <ol className="flex flex-col gap-3">
        {hints.map((hint) => {
          const access = accessFor(hint, hints[hint.tier - 2], lastRunAt, now);
          const revealing = revealingTier === hint.tier;
          return (
            <li
              key={hint.tier}
              className={cn(
                "flex flex-col gap-2 rounded-lg border border-border-token p-3",
                hint.revealed ? "bg-accent/10" : "bg-surface-sunken",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  <span aria-hidden="true">💡</span>
                  {t("tier", { tier: hint.tier })}
                </span>
                {hint.tier >= 3 ? (
                  <span className="text-xs font-semibold text-warning">
                    {t("starCapNote")}
                  </span>
                ) : null}
              </div>

              {hint.revealed && hint.text ? (
                <p className="text-sm leading-relaxed text-ink">{hint.text}</p>
              ) : hint.revealed && revealing ? (
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <Spinner size="sm" /> {t("loading")}
                </p>
              ) : access.kind === "open" ? (
                <div className="flex flex-col gap-2">
                  {hint.error ? (
                    <p className="text-sm text-danger">{t("error")}</p>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="lg"
                    loading={revealing}
                    onClick={() => onReveal(hint.tier)}
                    className="self-start"
                  >
                    {t("reveal")}
                  </Button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    className="size-4 shrink-0"
                  >
                    <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" />
                    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
                  </svg>
                  {access.kind === "lockedPrevious"
                    ? t("lockedPrevious", { tier: hint.tier - 1 })
                    : t("lockedCountdown", {
                        time: formatCountdown(access.remainingMs),
                      })}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </Dialog>
  );
}
