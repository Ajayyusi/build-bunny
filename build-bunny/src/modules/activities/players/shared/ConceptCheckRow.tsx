"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { answerConceptCheck as answerConceptCheckAction } from "@/modules/explore/server/actions";
import { cn, runAction } from "@/ui";

import { useLevelContext } from "./level-context";

const CHOICES = ["a", "b", "c"] as const;
type Choice = (typeof CHOICES)[number];

/**
 * "Quick check" on the success card of an Explore AI level: one question,
 * three fixed answers, instant feedback. It is the brief's "one short
 * explanation" without asking a child to type anything — the teacher sees
 * whether the idea landed first time, the child sees why it's right.
 *
 * Shown only once the save has landed (the server accepts an answer only
 * for a finished level) and only until the child has got it right once.
 */
export function ConceptCheckRow({ ready }: { ready: boolean }) {
  const level = useLevelContext();
  const check = level?.explore?.check ?? null;
  const t = useTranslations("student.play.check");
  const questionId = useId();
  const [picked, setPicked] = useState<Choice | null>(null);
  const [wrong, setWrong] = useState<ReadonlySet<Choice>>(new Set());
  const [right, setRight] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!level || !check || check.answeredCorrectly || !ready) return null;
  const concept = check.concept;

  const answer = async (choice: Choice) => {
    if (busy || right) return;
    setPicked(choice);
    setBusy(true);
    setFailed(false);
    try {
      const result = await runAction(() => answerConceptCheckAction({ levelId: level.levelId, choice }));
      if (!result.ok) {
        setFailed(true);
        return;
      }
      if (result.data.correct) setRight(choice);
      else setWrong((previous) => new Set(previous).add(choice));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-brand/30 bg-brand/5 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
        <span aria-hidden="true">💡 </span>
        {t("title")}
      </p>
      <p id={questionId} className="text-sm font-semibold text-ink">
        {t(`${concept}.question`)}
      </p>
      <div role="radiogroup" aria-labelledby={questionId} className="flex flex-col gap-2">
        {CHOICES.map((choice) => {
          const isRight = right === choice;
          const isWrong = wrong.has(choice);
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={picked === choice}
              // A wrong answer stays tappable-looking but is spent: the child
              // is steered to the other two, never stuck.
              disabled={busy || Boolean(right) || isWrong}
              onClick={() => void answer(choice)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 py-2 text-start text-sm font-semibold transition-colors",
                isRight
                  ? "border-positive bg-positive/10 text-ink"
                  : isWrong
                    ? "border-border-token bg-surface-sunken text-ink-muted line-through decoration-2"
                    : "border-border-token bg-surface-raised text-ink hover:bg-surface-sunken",
              )}
            >
              <span aria-hidden="true" className="w-5 shrink-0 text-center">
                {isRight ? "✓" : isWrong ? "✗" : "•"}
              </span>
              {t(`${concept}.${choice}`)}
            </button>
          );
        })}
      </div>
      <p role="status" className="min-h-5 text-sm text-ink">
        {right ? (
          <>
            <strong>{t("right")}</strong> {t(`${concept}.why`)}
          </>
        ) : failed ? (
          <span className="text-ink-muted">{t("notSaved")}</span>
        ) : wrong.size > 0 ? (
          <span className="text-ink-muted">{t("tryAgain")}</span>
        ) : null}
      </p>
    </div>
  );
}
