"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui";

import styles from "./player.module.css";
import type { ActivityFeedback } from "../../types";

/**
 * Located failure feedback (m3 contract, generalized in m4 task 4 for
 * CODE_PREDICTION/SEQUENCING): grid engines use the step-located codes
 * (bumped, splashed, …); the answer engines use wrongOption/wrongOrder, and
 * the Learn step uses tryAnotherBlock — deliberately an invitation rather
 * than a verdict, since a lesson has no failure state.
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
  "wrongOption",
  "wrongOrder",
  "tryAnotherBlock",
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
  wrongOption: "🤔",
  wrongOrder: "🔀",
  tryAnotherBlock: "🧩",
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
}

export function ResultBanner({
  feedback,
  onTryAgain,
  showHintNudge,
  onOpenHints,
  overrideMessage,
}: ResultBannerProps) {
  const t = useTranslations("student.play.feedback");
  const feedbackText = useFeedbackText();
  const code = feedback && KNOWN_CODES.has(feedback.code) ? feedback.code : "generic";

  return (
    <div
      role="alert"
      className={`${styles.banner} rounded-lg border border-danger/35 bg-surface-raised p-4 shadow-raised`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          {CODE_ICON[code]}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm font-semibold leading-relaxed text-ink">
            {overrideMessage ?? feedbackText(feedback)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={onTryAgain}>
              {t("tryAgain")}
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
          </div>
        </div>
      </div>
    </div>
  );
}
