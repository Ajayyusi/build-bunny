"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ReadAloudButton } from "@/modules/audio/AudioControls";
import { useNarrateOnShow } from "@/modules/audio/scene";
import { Badge, BunnyMascot, Button, useFocusTrap, type BadgeVariant } from "@/ui";

import { MissionIntro } from "./MissionIntro";
import styles from "./player.module.css";

interface IntroOverlayProps {
  title: string;
  story: string;
  objective: string;
  instructions: string;
  difficulty: string;
  estimatedMinutes: number;
  /**
   * World theme for the game-entry transition's environment. Optional so a
   * player that has no world context still renders the briefing.
   */
  worldTheme?: string;
  /**
   * An animation of the mechanic, shown above the "How to play" text.
   *
   * The briefing has always described how to play in a paragraph. For a
   * Grade 3 reader meeting a Blockly workspace, prose is the one format
   * that cannot land — so each engine passes a scene showing its mechanic
   * happening, and the words underneath name what is already moving.
   * Optional: an engine without a scene renders the briefing as before.
   */
  howScene?: ReactNode;
  /**
   * Re-opened from the mission strip mid-level: no arrival animation, and the
   * button returns to the blocks instead of "starting".
   */
  reopened?: boolean;
  /** Saved blocks were restored: the button says "Continue building". */
  resumeDraft?: boolean;
  onStart: () => void;
}

const DIFFICULTY_VARIANT: Record<string, BadgeVariant> = {
  EASY: "positive",
  MEDIUM: "warning",
  HARD: "danger",
};

/**
 * The level's opening beat, on ONE screen: Robo Bunny tells the story in a
 * speech bubble, the mission sits highlighted beneath it, then the
 * how-to-play animation and "Let's build!". It used to be two cards (story,
 * Next, mission), after a map sheet that had already shown the same story —
 * three reads and two taps before a child touched a block. Sits over the
 * whole player on a solid surface so the workspace appears only when the
 * student is briefed. Shared across every activity engine's player (m4
 * task 4) — nothing here assumes a grid.
 */
export function IntroOverlay({
  title,
  story,
  objective,
  instructions,
  difficulty,
  estimatedMinutes,
  worldTheme,
  howScene,
  reopened = false,
  resumeDraft = false,
  onStart,
}: IntroOverlayProps) {
  const t = useTranslations("student.play.intro");
  const tAdventure = useTranslations("student.adventure.intro");
  const hasStory = story.trim().length > 0;
  // The run-in plays first, then the briefing. MissionIntro calls onDone
  // immediately under reduced motion, so that preference lands the student
  // straight on the briefing with no dead frame.
  const [arriving, setArriving] = useState(
    worldTheme !== undefined && !reopened,
  );
  // Keyboard/screen-reader parity with the native <dialog>-based Dialog
  // component: this overlay can't use <dialog> (it's absolutely positioned
  // inside the immersive player, not top-layer), so the trap is manual.
  const dialogRef = useFocusTrap<HTMLDivElement>(true, arriving);
  // With narration on, Robo Bunny reads the story and the mission as the
  // briefing appears — the part a seven-year-old most needs to hear.
  const spoken = [story, objective].filter((part) => part.trim()).join(" ");
  useNarrateOnShow(arriving ? null : spoken);

  const difficultyLabel =
    difficulty in DIFFICULTY_VARIANT
      ? tAdventure(`difficulty.${difficulty}`)
      : difficulty;

  if (arriving && worldTheme !== undefined) {
    return (
      <MissionIntro
        worldTheme={worldTheme}
        title={title}
        onDone={() => setArriving(false)}
      />
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className={`${styles.overlay} absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-surface p-4 focus:outline-none`}
    >
      <div
        className={`${styles.card} flex w-full max-w-md flex-col gap-4 rounded-xl border border-border-token bg-surface-raised p-6 shadow-raised`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant={DIFFICULTY_VARIANT[difficulty] ?? "neutral"}>
              {difficultyLabel}
            </Badge>
            <Badge variant="neutral">
              <span aria-hidden="true">⏱</span>
              {tAdventure("minutes", { minutes: estimatedMinutes })}
            </Badge>
          </div>
        </div>

        {/* Robo Bunny tells the story — the guide speaks, rather than a
            paragraph floating above a mascot. */}
        <div className="flex items-end gap-3">
          <BunnyMascot state={hasStory ? "waving" : "jumping"} size="sm" className="shrink-0" />
          {hasStory ? (
            <p className="relative flex-1 rounded-2xl rounded-es-sm border border-border-token bg-surface-sunken px-4 py-3 text-base leading-relaxed text-ink">
              {story}
            </p>
          ) : null}
          <ReadAloudButton text={spoken} />
        </div>

        {objective ? (
          <div className="flex flex-col gap-1 rounded-xl border-2 border-brand/40 bg-brand/10 p-4">
            <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
              <span aria-hidden="true">🎯</span>
              {t("missionHeading")}
            </h2>
            <p className="text-base font-semibold leading-relaxed text-ink">
              {objective}
            </p>
          </div>
        ) : null}

        {instructions || howScene ? (
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-bold text-ink">
              {t("howHeading")}
            </h2>
            {howScene}
            {instructions ? (
              <p className="text-sm leading-relaxed text-ink-muted">
                {instructions}
              </p>
            ) : null}
          </div>
        ) : null}

        {resumeDraft && !reopened ? (
          <p role="status" className="rounded-lg bg-info/10 px-3 py-2 text-sm font-semibold text-ink">
            {t("draftRestored")}
          </p>
        ) : null}
        <div className="flex justify-end pt-1">
          <Button size="lg" onClick={onStart} className="w-full sm:w-auto">
            {reopened ? t("resume") : resumeDraft ? t("continueBuilding") : t("start")}
          </Button>
        </div>
      </div>
    </div>
  );
}
