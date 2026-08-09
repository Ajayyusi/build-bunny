"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Badge, cn } from "@/ui";

import styles from "./adventure.module.css";
import { LevelNode } from "./LevelNode";
import { themeEmoji } from "./theme";
import type { TrailLevelVM, TrailWorldVM } from "./types";

interface WorldSegmentProps {
  world: TrailWorldVM;
  onOpenLevel: (level: TrailLevelVM) => void;
}

/**
 * Serpentine placement: each level row is a 5-column grid and the node walks
 * the columns center → edge → center → opposite edge. Grid columns follow
 * writing direction, so the winding path mirrors for free in RTL. Static
 * class literals keep Tailwind's scanner happy.
 */
const PATH_COLUMNS = [
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-4",
  "col-start-3",
  "col-start-2",
  "col-start-1",
  "col-start-2",
] as const;

function ProgressChip({
  icon,
  srText,
  value,
}: {
  icon: string;
  srText: string;
  value: string;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-token bg-surface-raised/75 px-3 text-xs font-bold">
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{srText}</span>
      <span aria-hidden="true" className="tabular-nums">
        {value}
      </span>
    </span>
  );
}

export function WorldSegment({ world, onOpenLevel }: WorldSegmentProps) {
  const t = useTranslations("student.adventure");
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      data-world-theme={world.theme}
      className={cn(styles.world, "px-4 py-10 sm:px-8")}
    >
      <header className="mx-auto flex max-w-xl flex-col items-center gap-1.5 text-center">
        <span aria-hidden="true" className="text-3xl">
          {themeEmoji(world.theme)}
        </span>
        <h2
          id={headingId}
          className={cn(styles.worldTitle, "font-display text-2xl font-bold")}
        >
          {world.name}
        </h2>
        {world.tagline ? (
          <p className="text-sm font-medium text-ink-muted">{world.tagline}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <ProgressChip
            icon="🚩"
            srText={t("progressLevelsSr", {
              done: world.completedLevels,
              total: world.totalLevels,
            })}
            value={`${world.completedLevels}/${world.totalLevels}`}
          />
          <ProgressChip
            icon="⭐"
            srText={t("progressStarsSr", {
              earned: world.starsEarned,
              total: world.totalStars,
            })}
            value={`${world.starsEarned}/${world.totalStars}`}
          />
          {world.state === "COMPLETED" ? (
            <Badge variant="positive">{t("worldComplete")}</Badge>
          ) : null}
        </div>
      </header>

      <ol className="mx-auto mt-8 flex max-w-md flex-col gap-6">
        {world.levels.map((level, index) => (
          <li key={level.id} className="flex flex-col gap-4">
            {level.moduleLabel ? (
              <div className="flex justify-center">
                <span className="rounded-full border border-border-token bg-surface-raised/75 px-3 py-1 text-xs font-bold text-ink-muted">
                  {level.moduleLabel}
                </span>
              </div>
            ) : null}
            <div className="grid grid-cols-5">
              <div
                className={cn(
                  "flex justify-center",
                  PATH_COLUMNS[index % PATH_COLUMNS.length],
                )}
              >
                <LevelNode level={level} onOpen={onOpenLevel} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
