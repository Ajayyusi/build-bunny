"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { ReadAloudButton } from "@/modules/audio/AudioControls";
import { useNarrateOnShow } from "@/modules/audio/scene";
import { useSound } from "@/ui";

import { Button } from "@/ui";

import styles from "./player.module.css";
import type { ActivityFeedback } from "../../types";

/**
 * Located failure feedback (m3 contract, generalized in m4 task 4 for
 * CODE_PREDICTION/SEQUENCING): grid engines use the step-located codes
 * (bumped, splashed, …); the answer engines use wrongOption/wrongOrder, and
 * the Learn step uses tryAnotherBlock — deliberately an invitation rather
 * than a verdict, since a lesson has no failure state. The AI_SIM widgets
 * (phase G graft) report classifierErrors / trendMissTooHigh /
 * mysteryRoundsWrong — always "how close", never "which one".
 * Shared across every activity engine's player.
 */
const KNOWN_CODES = new Set([
  "bumped",
  "splashed",
  "carrotsLeft",
  "notOnGoal",
  "tooManyBlocks",
  "budget",
  "runtimeError",
  "missingBlock",
  "forbiddenBlock",
  "wrongOutput",
  "wrongVariable",
  "wrongOption",
  "wrongOrder",
  "tryAnotherBlock",
  "classifierErrors",
  "trendMissTooHigh",
  "mysteryRoundsWrong",
  // Pre-run coaching (client-only, nothing is graded or posted): the program
  // is empty, or its blocks are not snapped under "when start".
  "emptyProgram",
  "looseBlocks",
  "noTrick",
  // CREATIVE_PROJECT: the design broke a checklist rule (server-side re-check).
  "mazeInvalid",
]);

const CODE_ICON: Record<string, string> = {
  bumped: "💥",
  splashed: "💦",
  carrotsLeft: "🥕",
  notOnGoal: "🎯",
  tooManyBlocks: "🧮",
  budget: "🔁",
  runtimeError: "⚠️",
  missingBlock: "🧩",
  forbiddenBlock: "🧩",
  wrongOutput: "💬",
  wrongVariable: "🔢",
  wrongOption: "🤔",
  wrongOrder: "🔀",
  tryAnotherBlock: "🧩",
  classifierErrors: "📈",
  trendMissTooHigh: "📉",
  mysteryRoundsWrong: "🖼️",
  emptyProgram: "🧩",
  looseBlocks: "🔗",
  noTrick: "🎩",
  mazeInvalid: "🧱",
  generic: "🔍",
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Located feedback text for a {code, data} pair. Exposed as a hook so the
 * success card can reuse the same mapping for its "for more stars" note.
 */
export function useFeedbackText(): (feedback: ActivityFeedback | null) => string {
  const t = useTranslations("student.play.feedback");
  const tBlocks = useTranslations("student.play.blockNames");

  return (feedback) => {
    const code = feedback && KNOWN_CODES.has(feedback.code) ? feedback.code : "generic";
    const data = feedback?.data ?? {};
    switch (code) {
      case "bumped":
      case "splashed":
        return t(code, { step: asNumber(data.step, 1) });
      case "carrotsLeft":
        return t(code, {
          collected: asNumber(data.collected),
          total: asNumber(data.total),
        });
      case "tooManyBlocks":
        return t(code, { used: asNumber(data.used), max: asNumber(data.max) });
      case "classifierErrors":
        return t(code, { errors: asNumber(data.errors), maxErrors: asNumber(data.maxErrors) });
      case "trendMissTooHigh":
        return t(code, {
          childScore: asNumber(data.childScore),
          targetScore: asNumber(data.targetScore),
        });
      case "mysteryRoundsWrong":
        return t(code, { correct: asNumber(data.correct), total: asNumber(data.total) });
      case "wrongVariable":
        return t(code, {
          expected: String(data.expected ?? "?"),
          actual: data.actual === null || data.actual === undefined ? t("noValue") : String(data.actual),
        });
      case "missingBlock":
      case "forbiddenBlock": {
        const blockType = typeof data.blockType === "string" ? data.blockType : "";
        const known = tBlocks.has(blockType);
        return t(code, { block: known ? tBlocks(blockType) : blockType });
      }
      default:
        return t(code);
    }
  };
}

interface ResultBannerProps {
  feedback: ActivityFeedback | null;
  onTryAgain: () => void;
  /** After two straight failures: nudge toward the hint drawer. */
  showHintNudge: boolean;
  onOpenHints: () => void;
  /**
   * Pre-resolved text that takes precedence over the code-based i18n lookup —
   * CODE_PREDICTION uses this for the authored wrongFeedback copy when the
   * level provides it.
   */
  overrideMessage?: string | null;
  /**
   * "fail" — a run that did not reach the goal (assertive, retry action).
   * "coach" — Robo Bunny pointing something out BEFORE anything ran (an
   * empty or unsnapped program): polite, calmer border, "Got it".
   */
  tone?: "fail" | "coach";
  /**
   * "Why did that fail?" — opens Robo Bunny's explanation of this run.
   * Rendered whenever provided; the label is passed in because the help
   * copy lives in its own namespace.
   */
  onWhy?: () => void;
  whyLabel?: string;
}

export function ResultBanner({
  feedback,
  onTryAgain,
  showHintNudge,
  onOpenHints,
  overrideMessage,
  tone = "fail",
  onWhy,
  whyLabel,
}: ResultBannerProps) {
  const t = useTranslations("student.play.feedback");
  const feedbackText = useFeedbackText();
  const code = feedback && KNOWN_CODES.has(feedback.code) ? feedback.code : "generic";
  const message = overrideMessage ?? feedbackText(feedback);
  const { play } = useSound();
  useEffect(() => {
    if (tone === "fail" && code !== "bumped" && code !== "splashed") play("oops");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per banner
  }, []);
  useNarrateOnShow(message);

  return (
    <div
      role={tone === "coach" ? "status" : "alert"}
      className={`${styles.banner} rounded-lg border ${tone === "coach" ? "border-info/50" : "border-danger/35"} bg-surface-raised p-4 shadow-raised`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          {CODE_ICON[code]}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm font-semibold leading-relaxed text-ink">
              {message}
            </p>
            <ReadAloudButton text={message} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={onTryAgain}>
              {tone === "coach" ? t("gotIt") : t("tryAgain")}
            </Button>
            {showHintNudge ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={onOpenHints}
                className={styles.nudgePulse}
              >
                <span aria-hidden="true">💡</span>
                {t("hintNudge")}
              </Button>
            ) : null}
            {tone === "fail" && onWhy && whyLabel ? (
              <Button variant="ghost" size="lg" onClick={onWhy} aria-haspopup="dialog">
                <span aria-hidden="true">🐰</span>
                {whyLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
