"use client";

import { useTranslations } from "next-intl";

import { Badge, Button, cn, Dialog, type BadgeVariant } from "@/ui";

import type { TrailLevelVM } from "./types";

interface LevelIntroSheetProps {
  level: TrailLevelVM;
  onClose: () => void;
}

const DIFFICULTY_VARIANT: Record<string, BadgeVariant> = {
  EASY: "positive",
  MEDIUM: "warning",
  HARD: "danger",
};

const KNOWN_DIFFICULTIES = new Set(Object.keys(DIFFICULTY_VARIANT));

/**
 * Level intro dialog — story, mission and how-to from the published snapshot.
 * M2 is browse-only: Close is the single action; the Start button is the
 * player's one-line addition in M3.
 */
export function LevelIntroSheet({ level, onClose }: LevelIntroSheetProps) {
  const t = useTranslations("student.adventure");
  const intro = level.intro;
  if (!intro) return null;

  const difficultyLabel = KNOWN_DIFFICULTIES.has(intro.difficulty)
    ? t(`intro.difficulty.${intro.difficulty}`)
    : intro.difficulty;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("node.label", { number: level.number, title: intro.title })}
      closeLabel={t("intro.close")}
      footer={
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t("intro.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={DIFFICULTY_VARIANT[intro.difficulty] ?? "neutral"}>
            {difficultyLabel}
          </Badge>
          <Badge variant="neutral">
            <span aria-hidden="true">⏱</span>
            {t("intro.minutes", { minutes: intro.estimatedMinutes })}
          </Badge>
          <span
            className="ms-auto inline-flex items-center gap-1"
            role="img"
            aria-label={t("node.stars", {
              stars: intro.stars,
              maxStars: intro.maxStars,
            })}
          >
            {Array.from({ length: intro.maxStars }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  "text-base leading-none",
                  index < intro.stars ? "text-accent" : "text-ink-faint",
                )}
              >
                ★
              </span>
            ))}
          </span>
        </div>

        {intro.story ? (
          <p className="text-sm leading-relaxed text-ink">{intro.story}</p>
        ) : null}

        {intro.objective ? (
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-sm font-bold text-ink">
              {t("intro.objectiveHeading")}
            </h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              {intro.objective}
            </p>
          </div>
        ) : null}

        {intro.instructions ? (
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-sm font-bold text-ink">
              {t("intro.instructionsHeading")}
            </h3>
            <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">
              {intro.instructions}
            </p>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
