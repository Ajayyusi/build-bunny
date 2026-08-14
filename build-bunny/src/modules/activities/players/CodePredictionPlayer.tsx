"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { CodeView } from "@/modules/blockly/CodeView";
import { Button, cn, useReducedMotion } from "@/ui";

import { HintDrawer, type HintTierState } from "./shared/HintDrawer";
import { IntroOverlay } from "./shared/IntroOverlay";
import { ResultBanner } from "./shared/ResultBanner";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import type {
  ActivityPlayerProps,
  AttemptResponse,
  CodePredictionActivityPayload,
} from "../types";
import { resolveLocalized } from "../types";

/**
 * CODE_PREDICTION player (m4 task 4): the student reads a short program
 * (never executed — this is a comprehension check) and picks the option
 * that describes what it does. No local optimistic grading: the answer is
 * either right or wrong, so the POST response is the only verdict there
 * ever is. Same overlay language as the grid player (IntroOverlay,
 * SuccessOverlay, ResultBanner, HintDrawer) for a consistent player feel.
 */

type Phase = "intro" | "edit" | "result";

interface Submission {
  id: string;
  optionId: string;
  server: AttemptResponse | null;
  saveFailed: boolean;
}

export function CodePredictionPlayer({
  intro,
  payload: rawPayload,
  revealHintAction,
}: ActivityPlayerProps) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as CodePredictionActivityPayload;

  const t = useTranslations("student.play");
  const tPrediction = useTranslations("student.play.codePrediction");
  const locale = useLocale();

  const [phase, setPhase] = useState<Phase>("intro");
  const [selected, setSelected] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starsBest, setStarsBest] = useState(intro.starsBest);
  const [hintOpen, setHintOpen] = useState(false);
  const [revealingTier, setRevealingTier] = useState<number | null>(null);
  const [lastSubmitAt, setLastSubmitAt] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const [hints, setHints] = useState<HintTierState[]>(() =>
    [1, 2, 3, 4].map((tier) => ({
      tier,
      revealed: intro.hintsUsedTiers.includes(tier),
      text: null,
      revealedAt: 0,
      error: false,
    })),
  );
  const editStartRef = useRef<number>(Date.now());

  const submit = async (id: string, optionId: string) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/levels/${intro.levelId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptRunId: id, answer: { optionId } }),
      });
      if (!response.ok) throw new Error(`attempt ${response.status}`);
      const data = (await response.json()) as AttemptResponse;
      setSubmission({ id, optionId, server: data, saveFailed: false });
      setStarsBest((best) => Math.max(best, data.starsBest ?? 0));
      setLastSubmitAt(Date.now());
      setPhase("result");
    } catch {
      setSubmission({ id, optionId, server: null, saveFailed: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!selected || submitting) return;
    void submit(crypto.randomUUID(), selected);
  };

  const handleRetrySubmit = () => {
    if (!submission) return;
    void submit(submission.id, submission.optionId);
  };

  const handleTryAgain = () => {
    setSubmission(null);
    setSelected(null);
    setPhase("edit");
  };

  // ── Hints ──────────────────────────────────────────────────────────────

  const handleRevealHint = async (tier: number) => {
    setRevealingTier(tier);
    try {
      const result = await revealHintAction({ levelId: intro.levelId, tier });
      if (result.ok) {
        const text = resolveLocalized(result.data.text, locale);
        setHints((current) =>
          current.map((hint) =>
            hint.tier === tier
              ? {
                  ...hint,
                  revealed: true,
                  text: text || hint.text,
                  revealedAt: hint.revealed ? hint.revealedAt : Date.now(),
                  error: false,
                }
              : hint,
          ),
        );
      } else {
        setHints((current) =>
          current.map((hint) => (hint.tier === tier ? { ...hint, error: true } : hint)),
        );
      }
    } catch {
      setHints((current) =>
        current.map((hint) => (hint.tier === tier ? { ...hint, error: true } : hint)),
      );
    } finally {
      setRevealingTier(null);
    }
  };

  useEffect(() => {
    if (!hintOpen) return;
    for (const hint of hints) {
      if (hint.revealed && hint.text === null && !hint.error) {
        void handleRevealHint(hint.tier);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintOpen]);

  // ── Derived view state ─────────────────────────────────────────────────

  const verdict = submission?.server?.verdict ?? null;
  const showSuccess = phase === "result" && (verdict === "PASS" || verdict === "PARTIAL");
  const showFailure = phase === "result" && submission?.server && !showSuccess;

  const unlockedNow = submission?.server?.unlockedLevelIds ?? [];
  const nextHref =
    intro.nextLevel && (!intro.nextLevel.locked || unlockedNow.includes(intro.nextLevel.id))
      ? `/play/${intro.nextLevel.id}`
      : null;
  const achievements = (submission?.server?.newAchievements ?? []).map((a) => ({
    slug: a.slug,
    icon: a.icon,
    name: resolveLocalized(a.name, locale) || a.slug,
  }));
  const worldCompletedName = submission?.server?.worldCompleted
    ? resolveLocalized(submission.server.worldCompleted.name, locale)
    : null;
  const wrongFeedbackText = payload.wrongFeedback
    ? resolveLocalized(payload.wrongFeedback, locale)
    : null;
  const promptText = resolveLocalized(payload.prompt, locale);

  return (
    <div className="relative flex h-dvh min-h-0 flex-col">
      {/* ── Top bar ── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-token bg-surface-raised px-2 sm:px-4">
        <Link
          href="/adventure"
          aria-label={t("backToMap")}
          className="grid size-11 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 rtl:-scale-x-100"
          >
            <path d="M10 3.5 5.5 8 10 12.5" />
          </svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink sm:text-lg">
          {intro.title}
        </h1>
        <span
          role="img"
          aria-label={t("starsBest", { stars: starsBest, maxStars: intro.maxStars })}
          className="hidden items-center gap-0.5 sm:flex"
        >
          {Array.from({ length: intro.maxStars }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={cn(
                "text-lg leading-none",
                index < starsBest ? "text-accent" : "text-ink-faint",
              )}
            >
              ★
            </span>
          ))}
        </span>
      </header>

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-bold text-ink">
              {tPrediction("codeHeading")}
            </h2>
            <CodeView code={payload.code} />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-display text-sm font-bold text-ink">{promptText}</h2>
            <div role="radiogroup" aria-label={promptText} className="flex flex-col gap-3">
              {payload.options.map((option) => {
                const text = resolveLocalized(option.text, locale);
                const checked = selected === option.id;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-start transition-colors",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2",
                      checked
                        ? "border-brand bg-brand/10"
                        : "border-border-token bg-surface-raised hover:bg-surface-sunken",
                      phase === "result" && "pointer-events-none opacity-90",
                    )}
                  >
                    <input
                      type="radio"
                      name="code-prediction-option"
                      value={option.id}
                      checked={checked}
                      onChange={() => setSelected(option.id)}
                      disabled={phase === "result" || submitting}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border-2",
                        checked ? "border-brand bg-brand" : "border-border-token",
                      )}
                    >
                      {checked ? <span className="size-2.5 rounded-full bg-on-brand" /> : null}
                    </span>
                    <span className="text-base font-medium leading-relaxed text-ink">
                      {text}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {showFailure ? (
            <ResultBanner
              feedback={submission?.server?.feedback ?? { code: "wrongOption" }}
              overrideMessage={wrongFeedbackText}
              onTryAgain={handleTryAgain}
              showHintNudge
              onOpenHints={() => setHintOpen(true)}
            />
          ) : null}

          {submission?.saveFailed ? (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-lg border border-danger/35 bg-surface-raised p-4 text-sm font-semibold text-ink"
            >
              {tPrediction("submitFailed")}
              <Button size="lg" variant="secondary" onClick={handleRetrySubmit}>
                {tPrediction("retry")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border-token bg-surface-raised p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:justify-center">
        <Button
          size="lg"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!selected || phase === "result"}
          className="min-w-0 flex-1 sm:flex-none sm:min-w-48"
        >
          {tPrediction("submit")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setHintOpen(true)}
          disabled={phase === "result"}
        >
          <span aria-hidden="true">💡</span>
          {t("hint")}
        </Button>
      </div>

      {/* ── Overlays ── */}
      {phase === "intro" ? (
        <IntroOverlay
          title={intro.title}
          story={intro.story}
          objective={intro.objective}
          instructions={intro.instructions}
          difficulty={intro.difficulty}
          estimatedMinutes={intro.estimatedMinutes}
          worldTheme={intro.worldTheme}
          onStart={() => {
            editStartRef.current = Date.now();
            setPhase("edit");
          }}
        />
      ) : null}

      {showSuccess && submission ? (
        <SuccessOverlay
          key={submission.id}
          stars={submission.server?.stars ?? 0}
          maxStars={intro.maxStars}
          xpAwarded={submission.server ? submission.server.xpAwarded : null}
          explanation={intro.explanation}
          achievements={achievements}
          worldCompletedName={worldCompletedName}
          gradeMismatch={false}
          saving={false}
          saveFailed={false}
          onRetrySave={handleRetrySubmit}
          improveNote={null}
          nextHref={nextHref}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <HintDrawer
        open={hintOpen}
        onClose={() => setHintOpen(false)}
        hints={hints}
        lastRunAt={lastSubmitAt}
        revealingTier={revealingTier}
        onReveal={(tier) => void handleRevealHint(tier)}
      />
    </div>
  );
}
