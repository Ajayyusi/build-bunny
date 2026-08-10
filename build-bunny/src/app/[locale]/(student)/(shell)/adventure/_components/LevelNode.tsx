"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/ui";

import styles from "./adventure.module.css";
import type { TrailLevelVM } from "./types";

interface LevelNodeProps {
  level: TrailLevelVM;
  onOpen: (level: TrailLevelVM) => void;
  /**
   * 0-based index in the world's trail — used to stagger entrance and
   * shimmer so every node doesn't animate on the same frame.
   */
  index?: number;
}

const HINT_VISIBLE_MS = 2600;

const stateClasses: Record<TrailLevelVM["state"], string> = {
  COMPLETED:
    "border border-brand-strong bg-brand text-on-brand shadow-soft hover:bg-brand-strong",
  IN_PROGRESS:
    "border-2 border-brand/40 bg-surface-raised text-ink shadow-raised hover:border-brand/70",
  UNLOCKED:
    "border-2 border-brand/40 bg-surface-raised text-ink shadow-raised hover:border-brand/70",
  LOCKED: "border border-border-token bg-surface-sunken text-ink-faint",
};

/**
 * One trail stop. Unlocked/completed nodes open the intro sheet; locked nodes
 * shake and surface a prerequisite hint. The hint element stays mounted so
 * aria-describedby always resolves for screen readers — the click only
 * toggles its visibility for sighted users.
 */
export function LevelNode({ level, onOpen, index = 0 }: LevelNodeProps) {
  const t = useTranslations("student.adventure");
  const hintId = useId();
  const [shaking, setShaking] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const locked = level.state === "LOCKED";

  const handleClick = () => {
    if (!locked) {
      onOpen(level);
      return;
    }
    if (!shaking) setShaking(true);
    setHintShown(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHintShown(false), HINT_VISIBLE_MS);
  };

  // Direction-invariant "·" separator — the parts themselves are localized.
  const ariaLabel = [
    t("node.label", { number: level.number, title: level.title }),
    t(`node.state.${level.state}`),
    level.state === "COMPLETED"
      ? t("node.stars", { stars: level.stars, maxStars: level.maxStars })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn("relative flex flex-col items-center", styles.nodeEntrance)}
      style={{ "--i": index } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={handleClick}
        onAnimationEnd={() => setShaking(false)}
        aria-label={ariaLabel}
        aria-disabled={locked || undefined}
        aria-describedby={locked ? hintId : undefined}
        aria-current={level.current ? "step" : undefined}
        aria-haspopup={locked ? undefined : "dialog"}
        className={cn(
          "relative grid size-14 place-items-center rounded-full transition-colors md:size-16",
          stateClasses[level.state],
          !locked && styles.nodePop,
          locked && styles.nodeLocked,
          level.current && styles.nodeCurrent,
          level.state === "COMPLETED" && styles.nodeCompleted,
          shaking && styles.shake,
        )}
        style={{ "--i": index } as React.CSSProperties}
      >
        {locked ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" />
            <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
          </svg>
        ) : (
          <span aria-hidden="true" className="font-display text-xl font-bold">
            {level.number}
          </span>
        )}
      </button>

      {level.state === "COMPLETED" ? (
        <span
          aria-hidden="true"
          className="-mt-2 flex items-center gap-0.5 rounded-full border border-border-token bg-surface-raised px-1.5 py-px shadow-soft"
        >
          {Array.from({ length: level.maxStars }, (_, index) => (
            <span
              key={index}
              className={cn(
                "text-[10px] leading-none",
                index < level.stars ? "text-accent" : "text-ink-faint",
              )}
            >
              ★
            </span>
          ))}
        </span>
      ) : null}

      {locked ? (
        <span
          id={hintId}
          className={cn(
            styles.hint,
            hintShown && styles.hintShown,
            "rounded-md border border-border-token bg-surface-raised px-3 py-1.5 text-center text-xs font-semibold text-ink shadow-raised",
          )}
        >
          {level.prereqNumber !== null
            ? t("lockedHint", { number: level.prereqNumber })
            : t("lockedHintWorld")}
        </span>
      ) : null}
    </div>
  );
}
