"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { resolveLocalized } from "../../types";
import type { ActivityPlayerProps } from "../../types";
import type { HintTierState } from "./HintDrawer";

/**
 * Hint-drawer state for an activity player: the four tiers, revealing a tier
 * through the server action, and re-fetching the text of tiers revealed in an
 * earlier session (the server sends back only tier NUMBERS with the intro, so
 * their text has to be asked for on first open).
 *
 * Extracted because this exact block was already duplicated verbatim in two
 * players and was about to be pasted into two more — and because two of the
 * AI players had no hint UI at all, which quietly made every hint authored on
 * their levels unreachable. The server remains the only place that decides
 * whether a tier may be revealed (cooldowns, ordering, star cost); nothing
 * here is authoritative.
 */
export function useHints(
  levelId: string,
  hintsUsedTiers: number[],
  revealHintAction: ActivityPlayerProps["revealHintAction"],
) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [revealingTier, setRevealingTier] = useState<number | null>(null);
  const [hints, setHints] = useState<HintTierState[]>(() =>
    [1, 2, 3, 4].map((tier) => ({
      tier,
      revealed: hintsUsedTiers.includes(tier),
      text: null,
      revealedAt: 0,
      error: false,
    })),
  );

  const reveal = async (tier: number) => {
    setRevealingTier(tier);
    try {
      const result = await revealHintAction({ levelId, tier });
      if (result.ok) {
        const text = resolveLocalized(result.data.text, locale);
        setHints((current) =>
          current.map((hint) =>
            hint.tier === tier
              ? {
                  ...hint,
                  revealed: true,
                  text: text || hint.text,
                  // Keep the original reveal time: re-fetching the text of a
                  // tier revealed earlier must not restart its cooldown.
                  revealedAt: hint.revealed ? hint.revealedAt : Date.now(),
                  error: false,
                }
              : hint,
          ),
        );
      } else {
        setHints((current) =>
          current.map((hint) => (hint.tier === tier ? { ...hint, error: true } : hint)),
        );
      }
    } catch {
      setHints((current) =>
        current.map((hint) => (hint.tier === tier ? { ...hint, error: true } : hint)),
      );
    } finally {
      setRevealingTier(null);
    }
  };

  // Tiers revealed in an earlier session arrive as bare numbers; fetch their
  // text the first time the drawer is opened.
  useEffect(() => {
    if (!open) return;
    for (const hint of hints) {
      if (hint.revealed && hint.text === null && !hint.error) {
        void reveal(hint.tier);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on open only
  }, [open]);

  return { open, setOpen, hints, revealingTier, reveal };
}
