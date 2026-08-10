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
  /** Position in the trail — drives which side of the spine the card sits on. */
  index: number;
  onOpenLevel: (level: TrailLevelVM) => void;
}

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
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border-token bg-surface-raised/80 px-2.5 text-xs font-bold">
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{srText}</span>
      <span aria-hidden="true" className="tabular-nums">
        {value}
      </span>
    </span>
  );
}

/**
 * One stop on the path: a world card hanging off the dashed spine,
 * alternating sides on lg+ and stacking to the inline-start edge below it.
 *
 * The card carries the world's identity and progress; its levels remain
 * individually openable inside it, so this is a restyle of the trail rather
 * than a change to how a student reaches a level.
 */
export function WorldSegment({ world, index, onOpenLevel }: WorldSegmentProps) {
  const t = useTranslations("student.adventure");
  const headingId = useId();

  const locked = world.state === "LOCKED";
  const isCurrent = world.state === "CURRENT";
  const complete = world.state === "COMPLETED";
  const pct =
    world.totalLevels === 0
      ? 0
      : Math.round((world.completedLevels / world.totalLevels) * 100);
  // Cards alternate: even indices on the inline-start half, odd on the end.
  const onEndSide = index % 2 === 1;

  return (
    <li
      className={cn(
        "relative ps-12 lg:ps-0",
        // On lg the card occupies one half of the grid, leaving the other
        // half empty so the spine reads down the middle.
        "lg:grid lg:grid-cols-2 lg:gap-10",
      )}
    >
      {/* Spine connector dot, colored by state so the path shows progress. */}
      <span
        aria-hidden="true"
        className={cn(
          styles.spineDot,
          "grid size-6 place-items-center rounded-full border-2",
          complete && "border-brand bg-brand text-on-brand",
          isCurrent && "border-brand bg-surface-raised",
          locked && "border-border-token bg-surface-sunken",
          !complete && !isCurrent && !locked && "border-brand/50 bg-surface-raised",
        )}
      >
        {complete ? (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3"
          >
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        ) : locked ? (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-3 text-ink-faint"
          >
            <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" />
            <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
          </svg>
        ) : (
          <span className="size-2 rounded-full bg-brand" />
        )}
      </span>

      <section
        aria-labelledby={headingId}
        data-world-theme={world.theme}
        className={cn(
          styles.world,
          "bb-cascade rounded-2xl border border-border-token p-5 shadow-soft",
          locked && "opacity-70",
          // Alternate sides on lg. Column 2 needs an explicit start so the
          // card doesn't stretch across the spine.
          onEndSide ? "lg:col-start-2" : "lg:col-start-1",
        )}
        style={{ "--i": index } as React.CSSProperties}
      >
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl bg-surface-raised/80 text-2xl",
                !locked && styles.headerEmoji,
              )}
            >
              {themeEmoji(world.theme)}
            </span>
            {isCurrent ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold tracking-wide text-on-brand">
                <span aria-hidden="true">▶</span>
                {t("resume")}
              </span>
            ) : complete ? (
              <Badge variant="positive">{t("worldComplete")}</Badge>
            ) : null}
          </div>

          <h2
            id={headingId}
            className={cn(styles.worldTitle, "font-display text-xl font-bold")}
          >
            {world.name}
          </h2>
          {world.tagline ? (
            <p className="text-sm text-ink-muted">{world.tagline}</p>
          ) : null}

          {locked ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
              <span aria-hidden="true">🔒</span>
              {t("lockedHintWorld")}
            </p>
          ) : (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-2">
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
                <span className="ms-auto text-xs font-bold tabular-nums text-ink-muted">
                  {t("worldProgressPct", { pct })}
                </span>
              </div>
              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-raised/70">
                <span
                  aria-hidden="true"
                  className="block h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </span>
            </>
          )}
        </header>

        {/* Levels stay individually openable — the timeline restyles the
            world, it doesn't change how a student reaches a level. */}
        <ol className="mt-4 flex flex-wrap items-start gap-x-3 gap-y-4">
          {world.levels.map((level, i) => (
            <li key={level.id} className="flex flex-col items-center">
              <LevelNode level={level} onOpen={onOpenLevel} index={i} />
            </li>
          ))}
        </ol>
      </section>
    </li>
  );
}
