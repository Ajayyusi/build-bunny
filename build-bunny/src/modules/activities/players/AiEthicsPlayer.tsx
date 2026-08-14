"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button, cn, useReducedMotion } from "@/ui";

import { HintDrawer, type HintTierState } from "./shared/HintDrawer";
import { IntroOverlay } from "./shared/IntroOverlay";
import styles from "./shared/player.module.css";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import type {
  ActivityPlayerProps,
  AiEthicsActivityPayload,
  AttemptResponse,
} from "../types";
import { resolveLocalized, resolveNextSceneIndex } from "../types";

/**
 * AI_ETHICS player (phase G, "Secret Keepers"): a branching privacy
 * scenario. Every scene offers 2-4 plain, fully keyboard-operable choice
 * buttons; the chosen outcome is the teaching moment (never a scolding
 * "wrong!") and the story moves on to `choice.next` when authored, else the
 * next scene in order — the exact rule resolveNextSceneIndex (../types)
 * also drives server-side, so what the child experiences and what gets
 * graded can never diverge. There are no wrong feelings: grading is
 * completion-based, so this player never shows a failure banner. The story
 * ends by assembling every takeaway into a "Privacy Shield" checklist before
 * the single POST that records the whole path.
 */

type Phase = "intro" | "scene" | "checklist" | "result";

interface Submission {
  id: string;
  path: { sceneId: string; choiceId: string }[];
  server: AttemptResponse | null;
  saveFailed: boolean;
}

export function AiEthicsPlayer({
  intro,
  payload: rawPayload,
  revealHintAction,
}: ActivityPlayerProps) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as AiEthicsActivityPayload;

  const t = useTranslations("student.play");
  const tEthics = useTranslations("student.play.aiEthics");
  const locale = useLocale();

  const [phase, setPhase] = useState<Phase>("intro");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [chosenChoiceId, setChosenChoiceId] = useState<string | null>(null);
  const [path, setPath] = useState<{ sceneId: string; choiceId: string }[]>([]);
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
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new beat's heading on every scene/checklist change —
  // this is inline content, not a modal, so a plain imperative focus (not a
  // full focus trap) is enough to keep keyboard/screen-reader users oriented.
  useEffect(() => {
    if (phase === "scene" || phase === "checklist") {
      headingRef.current?.focus();
    }
  }, [phase, sceneIndex]);

  const locked = phase === "result" || submitting;
  const scene = payload.scenes[sceneIndex];

  const choose = (choiceId: string) => {
    if (locked || chosenChoiceId) return;
    setChosenChoiceId(choiceId);
  };

  const handleContinue = () => {
    if (!scene || !chosenChoiceId) return;
    const choice = scene.choices.find((c) => c.id === chosenChoiceId);
    if (!choice) return;
    const nextPath = [...path, { sceneId: scene.id, choiceId: chosenChoiceId }];
    setPath(nextPath);
    const nextIndex = resolveNextSceneIndex(payload.scenes, sceneIndex, choice.next);
    setChosenChoiceId(null);
    if (nextIndex < payload.scenes.length) {
      setSceneIndex(nextIndex);
    } else {
      setPhase("checklist");
    }
  };

  const submit = async (id: string, submittedPath: { sceneId: string; choiceId: string }[]) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/levels/${intro.levelId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptRunId: id, answer: { path: submittedPath } }),
      });
      if (!response.ok) throw new Error(`attempt ${response.status}`);
      const data = (await response.json()) as AttemptResponse;
      setSubmission({ id, path: submittedPath, server: data, saveFailed: false });
      setStarsBest((best) => Math.max(best, data.starsBest ?? 0));
      setLastSubmitAt(Date.now());
      setPhase("result");
    } catch {
      setSubmission({ id, path: submittedPath, server: null, saveFailed: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    if (submitting || phase === "result") return;
    void submit(crypto.randomUUID(), path);
  };

  const handleRetrySubmit = () => {
    if (!submission) return;
    void submit(submission.id, submission.path);
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
  // Completion-based grading (there are no wrong feelings): every finished
  // path is a PASS, so this player never shows the ResultBanner/FAIL state.

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
  const chosenChoice = scene?.choices.find((c) => c.id === chosenChoiceId) ?? null;

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
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {phase === "scene" && scene ? (
            <div className="flex flex-col gap-4 rounded-xl border-2 border-border-token bg-surface-raised p-5">
              {scene.art ? (
                <span aria-hidden="true" className="text-center text-4xl">
                  {scene.art}
                </span>
              ) : null}
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-base font-bold text-ink focus:outline-none"
              >
                {resolveLocalized(scene.text, locale)}
              </h2>

              {!chosenChoiceId ? (
                <div className="flex flex-col gap-2">
                  {scene.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => choose(choice.id)}
                      disabled={locked}
                      className="min-h-11 rounded-lg border-2 border-border-token bg-surface-sunken px-4 py-3 text-start text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken/70 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      {resolveLocalized(choice.text, locale)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p
                    role="status"
                    className="rounded-lg bg-brand/10 p-3 text-sm leading-relaxed text-ink"
                  >
                    {chosenChoice ? resolveLocalized(chosenChoice.outcome, locale) : ""}
                  </p>
                  <Button size="lg" onClick={handleContinue} className="self-end">
                    {tEthics("continueStory")}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {phase === "checklist" ? (
            <div className="flex flex-col gap-4 rounded-xl border-2 border-border-token bg-surface-raised p-5">
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-center font-display text-lg font-bold text-ink focus:outline-none"
              >
                {tEthics("shieldTitle")}
              </h2>
              <span aria-hidden="true" className="text-center text-4xl">
                🛡️
              </span>
              <ul className="flex flex-col gap-2">
                {payload.takeaways.map((takeaway, index) => (
                  <li
                    key={index}
                    className={cn(
                      "flex items-start gap-2 rounded-lg bg-surface-sunken p-3 text-sm leading-relaxed text-ink",
                      styles.checklistItem,
                    )}
                    style={{ "--pop-delay": `${index * 120}ms` } as React.CSSProperties}
                  >
                    <span aria-hidden="true" className="text-accent">
                      ✓
                    </span>
                    {resolveLocalized(takeaway, locale)}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                onClick={handleFinish}
                loading={submitting}
                disabled={phase !== "checklist"}
                className="self-center"
              >
                {tEthics("finish")}
              </Button>
            </div>
          ) : null}

          {submission?.saveFailed ? (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-lg border border-danger/35 bg-surface-raised p-4 text-sm font-semibold text-ink"
            >
              {tEthics("submitFailed")}
              <Button size="lg" variant="secondary" onClick={handleRetrySubmit}>
                {tEthics("retry")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border-token bg-surface-raised p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
            setPhase("scene");
          }}
        />
      ) : null}

      {phase === "result" && submission ? (
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
