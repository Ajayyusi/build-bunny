"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button, cn, useReducedMotion } from "@/ui";

import { PlayerSoundControls } from "@/modules/audio/AudioControls";
import { HintDrawer, type HintTierState } from "./shared/HintDrawer";
import { HonestyNote } from "./shared/HonestyNote";
import { RoboHelp, type HelpTopic } from "./shared/RoboHelp";
import { postAttempt, runIdFor } from "./shared/attempt-outbox";
import { EthicsScene } from "./shared/EthicsScene";
import { NextStepHint } from "./shared/NextStepHint";
import { IntroOverlay } from "./shared/IntroOverlay";
import { MissionStrip } from "./shared/MissionStrip";
import { useDraftAutosave } from "./shared/useDraftAutosave";
import styles from "./shared/player.module.css";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import type {
  ActivityPlayerProps,
  AiEthicsActivityPayload,
  AttemptResponse,
} from "../types";
import { resolveLocalized, resolveNextSceneIndex } from "../types";
import { restoreEthicsDraft, type PathStep } from "./ethics-draft";

/**
 * AI_ETHICS player (phase G, "Secret Keepers"): a branching privacy
 * scenario. Every scene offers 2-4 plain, fully keyboard-operable choice
 * buttons; the chosen outcome is the teaching moment (never a scolding
 * "wrong!") and the story moves on to `choice.next` when authored, else the
 * next scene in order — the exact rule resolveNextSceneIndex (../types)
 * also drives server-side, so what the child experiences and what gets
 * graded can never diverge. There are no wrong feelings: grading is
 * completion-based, so this player never shows a failure banner.
 *
 * The loop per scene: choose (PREDICT what you'd do) → read what happens
 * (OBSERVE) → "Try a different choice" to see another outcome (RETRY), or
 * go on. Earlier tries are recorded with the step; the top star rewards a
 * safe first instinct. A scene can carry a machine's suggestion (what it
 * suggests, its reason, how sure it is) for the child to approve, ask more
 * about, or override. The story ends by assembling every takeaway into the
 * level's own checklist before the single POST that records the whole path.
 */

type Phase = "intro" | "scene" | "checklist" | "result";

interface Submission {
  id: string;
  path: PathStep[];
  server: AttemptResponse | null;
  saveFailed: boolean;
}

export function AiEthicsPlayer({
  intro,
  payload: rawPayload,
  draft,
  revealHintAction,
  nextStepAction,
  saveDraftAction,
}: ActivityPlayerProps) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as AiEthicsActivityPayload;
  const restored = useMemo(() => restoreEthicsDraft(draft, payload), [draft, payload]);

  const t = useTranslations("student.play");
  const tEthics = useTranslations("student.play.aiEthics");
  const locale = useLocale();

  const [phase, setPhase] = useState<Phase>("intro");
  // The briefing reopened from the mission strip, mid-level.
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(restored.sceneIndex);
  const [chosenChoiceId, setChosenChoiceId] = useState<string | null>(null);
  // Choices already tried in THIS scene, before the one on screen now.
  const [tried, setTried] = useState<string[]>([]);
  // The child's verdict on this scene, asked before the choices (PREDICT).
  const [predicted, setPredicted] = useState<string | null>(null);
  // The choice "Show me the next step" named, ringed until the child picks.
  const [pointed, setPointed] = useState<string | null>(null);
  const [path, setPath] = useState<PathStep[]>(restored.path);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starsBest, setStarsBest] = useState(intro.starsBest);
  const [hintOpen, setHintOpen] = useState(false);
  // "Ask Robo Bunny": why an answer was wrong, the smallest hint, and what
  // the level's idea is. Opens on a topic from the failure banner.
  const [roboOpen, setRoboOpen] = useState(false);
  const [roboTopic, setRoboTopic] = useState<HelpTopic | null>(null);
  const openRobo = (topic: HelpTopic | null) => {
    setRoboTopic(topic);
    setRoboOpen(true);
  };
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

  // A branching story is long, and a child part-way through one has real
  // work behind them. Only the path is stored — the scene to resume on is
  // derived from it, so the two can never disagree. Stops at the result:
  // the attempt is recorded and the draft should stop moving.
  useDraftAutosave(intro.levelId, { path }, saveDraftAction, phase !== "result");

  const choose = (choiceId: string) => {
    if (locked || chosenChoiceId) return;
    setChosenChoiceId(choiceId);
  };

  // Back to this scene's choices, to see what another one does.
  const tryAnother = () => {
    if (locked || !chosenChoiceId) return;
    setTried((current) => [...current, chosenChoiceId]);
    setChosenChoiceId(null);
  };

  const handleContinue = () => {
    if (!scene || !chosenChoiceId) return;
    const choice = scene.choices.find((c) => c.id === chosenChoiceId);
    if (!choice) return;
    const nextPath: PathStep[] = [
      ...path,
      {
        sceneId: scene.id,
        choiceId: chosenChoiceId,
        ...(tried.length > 0 ? { tried } : {}),
        ...(predicted ? { predicted } : {}),
      },
    ];
    setPath(nextPath);
    const nextIndex = resolveNextSceneIndex(payload.scenes, sceneIndex, choice.next);
    setChosenChoiceId(null);
    setTried([]);
    setPredicted(null);
    if (nextIndex < payload.scenes.length) {
      setSceneIndex(nextIndex);
    } else {
      setPhase("checklist");
    }
  };

  const submit = async (id: string, submittedPath: PathStep[]) => {
    setSubmitting(true);
    try {
      const response = await postAttempt(intro.playerKey, `/api/levels/${intro.levelId}/attempts`, {
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
    void submit(
      runIdFor(submission && { id: submission.id, saveFailed: submission.saveFailed, answer: submission.path }, path),
      path,
    );
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
  const predictedOption = scene?.predict?.options.find((o) => o.id === predicted) ?? null;

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
        {/* Instant mute + sound settings, in every level. */}
        <PlayerSoundControls />
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

      {phase !== "intro" ? (
        <MissionStrip
          objective={intro.objective}
          onShow={() => setBriefingOpen(true)}
        />
      ) : null}

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <HonestyNote kind="story" />
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

              {scene.suggestion ? (
                <MachineSuggestion
                  text={resolveLocalized(scene.suggestion.text, locale)}
                  reason={resolveLocalized(scene.suggestion.reason, locale)}
                  confidence={scene.suggestion.confidence}
                />
              ) : null}

              {scene.predict && !predicted ? (
                <div role="group" aria-labelledby={`predict-${scene.id}`} className="flex flex-col gap-2">
                  <p id={`predict-${scene.id}`} className="text-sm font-bold text-ink">
                    {resolveLocalized(scene.predict.question, locale)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {scene.predict.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={locked}
                        onClick={() => setPredicted(option.id)}
                        className="min-h-11 rounded-lg border-2 border-info/40 bg-info/10 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-info/20 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                      >
                        {resolveLocalized(option.text, locale)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : !chosenChoiceId ? (
                <div className="flex flex-col gap-2">
                  {predictedOption ? (
                    <p className="w-fit rounded-full bg-info/10 px-3 py-1 text-xs font-bold text-ink">
                      {tEthics("youSaid", { answer: resolveLocalized(predictedOption.text, locale) })}
                    </p>
                  ) : null}
                  {scene.choices.map((choice) => {
                    const wasTried = tried.includes(choice.id);
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => choose(choice.id)}
                        disabled={locked}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-lg border-2 border-border-token bg-surface-sunken px-4 py-3 text-start text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken/70 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                          pointed === choice.id && "ring-4 ring-accent ring-offset-2 ring-offset-surface",
                          wasTried && "border-dashed opacity-75",
                        )}
                      >
                        {choice.action ? (
                          <span aria-hidden="true">{ACTION_ICON[choice.action]}</span>
                        ) : null}
                        <span className="flex-1">{resolveLocalized(choice.text, locale)}</span>
                        {wasTried ? (
                          <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-bold text-ink-muted">
                            {tEthics("triedNote")}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p
                    role="status"
                    className="rounded-lg bg-brand/10 p-3 text-sm leading-relaxed text-ink"
                  >
                    {chosenChoice ? resolveLocalized(chosenChoice.outcome, locale) : ""}
                  </p>
                  {predictedOption ? (
                    <p className="rounded-lg border border-info/40 bg-surface-raised p-3 text-sm leading-relaxed text-ink">
                      <span className="font-bold">
                        {tEthics("youSaid", { answer: resolveLocalized(predictedOption.text, locale) })}
                      </span>{" "}
                      {resolveLocalized(predictedOption.note, locale)}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {scene.choices.some((c) => c.id !== chosenChoiceId && !tried.includes(c.id)) ? (
                      <Button size="lg" variant="secondary" onClick={tryAnother}>
                        {tEthics("tryAnother")}
                      </Button>
                    ) : null}
                    <Button size="lg" onClick={handleContinue}>
                      {tEthics("continueStory")}
                    </Button>
                  </div>
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
                {payload.checklist ? resolveLocalized(payload.checklist.title, locale) : tEthics("checklistTitle")}
              </h2>
              <span aria-hidden="true" className="text-center text-4xl">
                {payload.checklist?.icon ?? "📋"}
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
          onClick={() => openRobo(null)}
          aria-haspopup="dialog"
          disabled={phase === "result"}
        >
          <span aria-hidden="true">💡</span>
          {t("help.open")}
        </Button>
        {nextStepAction && phase !== "result" ? (
          <NextStepHint
            levelId={intro.levelId}
            action={nextStepAction}
            usedBefore={intro.hintsUsedTiers.includes(5)}
            readyAction={`“${tEthics(phase === "scene" && chosenChoiceId && sceneIndex < payload.scenes.length - 1 ? "continueStory" : "finish")}”`}
            getState={() => ({
              sceneId: phase === "scene" && !chosenChoiceId ? (scene?.id ?? null) : null,
              predicting: phase === "scene" && Boolean(scene?.predict) && !predicted,
            })}
            names={{
              choice: (id) => {
                const c = scene?.choices.find((x) => x.id === id);
                return c ? resolveLocalized(c.text, locale) : id;
              },
            }}
            onStep={(step) => setPointed(step.code === "chooseSafe" ? step.choiceId : null)}
          />
        ) : null}
      </div>

      {/* ── Overlays ── */}
      {phase === "intro" || briefingOpen ? (
        <IntroOverlay
          reopened={phase !== "intro"}
          title={intro.title}
          story={intro.story}
          objective={intro.objective}
          instructions={intro.instructions}
          difficulty={intro.difficulty}
          estimatedMinutes={intro.estimatedMinutes}
          worldTheme={intro.worldTheme}
          howScene={<EthicsScene />}
          onStart={() => {
            if (phase !== "intro") {
              setBriefingOpen(false);
              return;
            }
            editStartRef.current = Date.now();
            // A story finished in an earlier session reopens on its
            // checklist, ready to save — not on its last scene again.
            setPhase(restored.finished && path.length === restored.path.length ? "checklist" : "scene");
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
          keyIdea={intro.keyIdea}
          achievements={achievements}
          worldCompletedName={worldCompletedName}
          worldPower={submission?.server?.worldCompleted?.power ?? null}
          gradeMismatch={false}
          saving={false}
          saveFailed={false}
          onRetrySave={handleRetrySubmit}
          improveNote={null}
          onReplay={() => {
            setSubmission(null);
            setSceneIndex(0);
            setPath([]);
            setChosenChoiceId(null);
            setTried([]);
            setPredicted(null);
            setPhase("scene");
          }}
          certificate={submission.server?.certificate ?? null}
          nextHref={nextHref}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <RoboHelp
        open={roboOpen}
        onClose={() => setRoboOpen(false)}
        topics={["hint", "concept"]}
        tags={intro.tags}
        lastFailure={
          null
        }
        hints={hints}
        revealingTier={revealingTier}
        onRevealTier1={() => void handleRevealHint(1)}
        onOpenHints={() => {
          setRoboOpen(false);
          setHintOpen(true);
        }}
        initialTopic={roboTopic}
      />

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

const ACTION_ICON = { approve: "✅", askMore: "❓", override: "✋" } as const;

/**
 * A machine's suggestion for the child to review: what it suggests, the
 * reason it gives, and how sure it says it is. Confidence is shown as the
 * machine's own claim — sure is not the same as right, which is the point.
 */
function MachineSuggestion({ text, reason, confidence }: { text: string; reason: string; confidence: number }) {
  const tEthics = useTranslations("student.play.aiEthics");
  const percent = Math.round(confidence * 100);
  return (
    <section
      aria-label={tEthics("suggestionLabel")}
      className="flex flex-col gap-2 rounded-xl border-2 border-info/40 bg-info/10 p-4"
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
        <span aria-hidden="true">🤖</span>
        {tEthics("suggestionLabel")}
      </p>
      <p className="text-base font-semibold text-ink">{text}</p>
      <p className="text-sm text-ink">
        <span className="font-semibold">{tEthics("suggestionWhy")}</span> {reason}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-ink">{tEthics("suggestionSure", { percent })}</span>
        <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
          <span className="block h-full rounded-full bg-info" style={{ width: `${percent}%` }} />
        </span>
      </div>
    </section>
  );
}
