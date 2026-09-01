"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

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
  onStart: () => void;
}

const DIFFICULTY_VARIANT: Record<string, BadgeVariant> = {
  EASY: "positive",
  MEDIUM: "warning",
  HARD: "danger",
};

/**
 * The level's opening beat: story → mission → "Let's build". Sits over the
 * whole player on a solid surface so the workspace appears only when the
 * student is briefed. Skippable at every step. Shared across every activity
 * engine's player (m4 task 4) — nothing here assumes a grid.
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
  onStart,
}: IntroOverlayProps) {
  const t = useTranslations("student.play.intro");
  const tAdventure = useTranslations("student.adventure.intro");
  const hasStory = story.trim().length > 0;
  const [step, setStep] = useState<"story" | "mission">(
    hasStory ? "story" : "mission",
  );
  // The run-in plays first, then the briefing. MissionIntro calls onDone
  // immediately under reduced motion, so that preference lands the student
  // straight on the briefing with no dead frame.
  const [arriving, setArriving] = useState(worldTheme !== undefined);
  // Keyboard/screen-reader parity with the native <dialog>-based Dialog
  // component: this overlay can't use <dialog> (it's absolutely positioned
  // inside the immersive player, not top-layer), so the trap is manual.
  // resetKey=step re-focuses the first control when story → mission swaps.
  const dialogRef = useFocusTrap<HTMLDivElement>(true, step);

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
          <BunnyMascot state="jumping" size="sm" />
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

        {step === "story" ? (
          <>
            <p className="text-sm leading-relaxed text-ink">{story}</p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="lg" onClick={onStart}>
                {t("skip")}
              </Button>
              <Button size="lg" onClick={() => setStep("mission")}>
                {t("next")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-sm font-bold text-ink">
                {t("missionHeading")}
              </h2>
              <p className="text-sm leading-relaxed text-ink-muted">
                {objective}
              </p>
            </div>
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
            <div className="flex justify-end pt-1">
              <Button size="lg" onClick={onStart}>
                {t("start")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
