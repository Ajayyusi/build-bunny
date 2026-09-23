"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
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
 * Level preview on the map — title, difficulty, stars and the one-line
 * mission, then Start. The story and the how-to-play animation are told ONCE,
 * by the player's own briefing: this sheet used to repeat the story and the
 * instructions, so a child read the same paragraph twice before touching a
 * block. Close returns to the map.
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
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t("intro.close")}
          </Button>
          <Link
            href={`/play/${level.id}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-base font-semibold text-on-brand transition-colors hover:bg-brand-strong"
          >
            <span aria-hidden="true">▶</span>
            {t("intro.start")}
          </Link>
        </>
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

        {intro.objective ? (
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-sm font-bold text-ink">
              {t("intro.objectiveHeading")}
            </h3>
            <p className="text-base leading-relaxed text-ink">
              {intro.objective}
            </p>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
