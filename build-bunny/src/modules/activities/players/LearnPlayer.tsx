"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { BlockLocale } from "@/modules/blockly/blocks";
import type { BlocklyWorkspaceHandle } from "@/modules/blockly/BlocklyWorkspace";
import { blockTypeAt, findFadedGap } from "@/modules/blockly/serialization";
import SimulationCanvas from "@/modules/simulation/SimulationCanvas";
import { Button, cn, useReducedMotion } from "@/ui";

import { runForPlayback } from "./client-run";
import { HintDrawer, type HintTierState } from "./shared/HintDrawer";
import { IntroOverlay } from "./shared/IntroOverlay";
import { LearnDoneOverlay } from "./shared/LearnDoneOverlay";
import type {
  ActivityPlayerProps,
  AttemptResponse,
  LearnActivityPayload,
} from "../types";
import { resolveLocalized } from "../types";

// Blockly renders into a real DOM — client-only by contract.
const BlocklyWorkspace = dynamic(
  () => import("@/modules/blockly/BlocklyWorkspace"),
  { ssr: false },
);

/**
 * The CONCEPT_CARDS player — a Learn step
 * (docs/build-bunny/LEARN-STEP-SPEC.md). Three beats on one trail node,
 * 60–90 seconds:
 *
 *   1. SHOW   — the worked example runs on the grid, read-only, with each
 *               block lighting up as it executes.
 *   2. FADED  — the same program with one block removed. The student drops
 *               the missing block in. One gap only.
 *   3. DONE   — "Now try it yourself" → the puzzle that needs the concept.
 *
 * It deliberately wears the GridPlayer's shell (same sim panel, same Blockly
 * workspace, same grid): the concept is taught in the exact medium it is
 * about to be used in, which is the whole reason this is a lesson step rather
 * than a video or a wall of text.
 *
 * A lesson has no failure state. A wrong block re-prompts inline — the run is
 * still POSTed (the server is the only grading authority here as everywhere,
 * and which block a child reached for is the misconception signal worth
 * keeping), but nothing is lost: the level awards no stars, and no XP is
 * granted until the gap is right.
 */

type Phase = "intro" | "show" | "faded" | "done";

interface Submission {
  id: string;
  blockType: string;
  server: AttemptResponse | null;
  saveFailed: boolean;
}

export function LearnPlayer({
  intro,
  payload: rawPayload,
  revealHintAction,
}: ActivityPlayerProps) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as LearnActivityPayload;

  const t = useTranslations("student.play");
  const tLearn = useTranslations("student.play.learn");
  const locale = useLocale();
  const blockLocale: BlockLocale = locale === "ar" ? "ar" : "en";

  const [phase, setPhase] = useState<Phase>("intro");
  const [playing, setPlaying] = useState(false);
  const [watched, setWatched] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [wsKey, setWsKey] = useState(0);
  const [checking, setChecking] = useState(false);
  /** Inline re-prompt under the workspace; never a failure banner. */
  const [nudge, setNudge] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [revealingTier, setRevealingTier] = useState<number | null>(null);
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);
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

  const workspaceHandleRef = useRef<BlocklyWorkspaceHandle | null>(null);

  const variant = payload.variants[0]!;

  // The worked example is authored content, so this runs once per level: no
  // student input feeds it and nothing about it is graded.
  const workedRun = useMemo(
    () => runForPlayback(payload.workedExample.blocks, payload, blockLocale),
    [payload, blockLocale],
  );

  // Both memos matter: BlocklyWorkspace re-injects the whole editor whenever
  // its `payload` identity changes, so a fresh object literal per render
  // would tear down and rebuild Blockly on every keystroke of state.
  const workedWorkspacePayload = useMemo(
    // No toolbox: the worked example is read-only, and Blockly drops the
    // flyout entirely for a read-only workspace.
    () => ({ toolbox: [], startWorkspace: payload.workedExample.blocks }),
    [payload],
  );
  const fadedWorkspacePayload = useMemo(
    () => ({ toolbox: payload.faded.toolbox, startWorkspace: payload.faded.blocks }),
    [payload],
  );

  // Where the worked example has a block and the faded copy does not — the
  // one connection the student has to fill. Derived rather than authored:
  // both programs are already on the client (the student watches one and
  // edits the other), so this needs no extra payload field and cannot drift
  // out of sync with the content.
  const gapPath = useMemo(
    () => findFadedGap(payload.workedExample.blocks, payload.faded.blocks),
    [payload],
  );

  // ── Beat 1: show ───────────────────────────────────────────────────────

  const startWatching = () => {
    setHighlightId(null);
    setPlaying(true);
  };

  const handlePlaybackEnd = () => {
    setPlaying(false);
    setWatched(true);
    setHighlightId(null);
  };

  const goToFaded = () => {
    setPlaying(false);
    setHighlightId(null);
    setNudge(null);
    setPhase("faded");
  };

  // ── Beat 2: faded practice ─────────────────────────────────────────────

  const handleReset = () => {
    setWsKey((key) => key + 1);
    setNudge(null);
    setSubmission(null);
  };

  const submit = async (id: string, blockType: string) => {
    setChecking(true);
    try {
      const response = await fetch(`/api/levels/${intro.levelId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptRunId: id, answer: { blockType } }),
      });
      if (!response.ok) throw new Error(`attempt ${response.status}`);
      const data = (await response.json()) as AttemptResponse;
      setSubmission({ id, blockType, server: data, saveFailed: false });
      setLastCheckAt(Date.now());
      if (data.verdict === "PASS" || data.verdict === "PARTIAL") {
        setPhase("done");
      } else {
        setNudge(tLearn("notQuite"));
      }
    } catch {
      setSubmission({ id, blockType, server: null, saveFailed: true });
      setNudge(tLearn("checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  const handleCheck = () => {
    if (checking || phase !== "faded") return;
    const current = workspaceHandleRef.current?.getWorkspaceJson() ?? {};
    const filled = gapPath ? blockTypeAt(current, gapPath) : null;
    if (!filled) {
      // Empty gap, or a block dropped loose on the canvas / snapped somewhere
      // other than the gap. Nothing is submitted: there is no answer yet.
      setNudge(tLearn("needOneBlock"));
      return;
    }
    setNudge(null);
    void submit(crypto.randomUUID(), filled);
  };

  const handleRetrySave = () => {
    if (!submission) return;
    void submit(submission.id, submission.blockType);
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

  const showing = phase === "show";
  const caption = resolveLocalized(
    showing ? payload.workedExample.caption : payload.faded.caption,
    locale,
  );
  const stepLabel = tLearn(showing ? "stepWatch" : "stepYourTurn");

  const unlockedNow = submission?.server?.unlockedLevelIds ?? [];
  const nextHref =
    intro.nextLevel && (!intro.nextLevel.locked || unlockedNow.includes(intro.nextLevel.id))
      ? `/play/${intro.nextLevel.id}`
      : null;

  const actionButtons = showing ? (
    <>
      <Button
        size="lg"
        variant="secondary"
        onClick={startWatching}
        disabled={playing}
        className="min-w-0 flex-1 sm:flex-none sm:min-w-36"
      >
        <span aria-hidden="true">▶</span>
        {tLearn(playing ? "playing" : watched ? "watchAgain" : "watch")}
      </Button>
      {/* Deliberately NOT disabled while playing. Watch playback ends by a
          callback from the canvas, so anything that stops the frame loop —
          a backgrounded tab, a stalled device, a draw error — leaves
          `playing` true forever. If this button were disabled then too, both
          controls would be dead and the only way out of the lesson would be
          reloading the page. goToFaded already clears `playing` first, so
          letting a student leave mid-playback is safe. */}
      <Button size="lg" onClick={goToFaded}>
        {tLearn("myTurn")}
      </Button>
    </>
  ) : (
    <>
      <Button
        size="lg"
        onClick={handleCheck}
        loading={checking}
        className="min-w-0 flex-1 sm:flex-none sm:min-w-36"
      >
        {tLearn("check")}
      </Button>
      <Button variant="secondary" size="lg" onClick={handleReset} disabled={checking}>
        {t("reset")}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => setHintOpen(true)}
        disabled={checking}
      >
        <span aria-hidden="true">💡</span>
        {t("hint")}
      </Button>
    </>
  );

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
        {/* No star row: a Learn step awards none. The two-step progress
            indicator takes that slot instead, so the child always knows how
            much lesson is left. */}
        <span className="shrink-0 rounded-full border border-border-token bg-surface-sunken px-3 py-1 text-xs font-bold text-ink-muted">
          {stepLabel}
        </span>
      </header>

      {/* ── Sim + workspace ── */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          aria-label={t("simRegion")}
          className="relative flex h-[42dvh] shrink-0 flex-col border-b border-border-token lg:h-auto lg:w-[42%] lg:shrink lg:border-b-0 lg:border-e"
        >
          <div className="relative min-h-0 flex-1 p-2 sm:p-3">
            <SimulationCanvas
              variant={variant}
              theme={intro.worldTheme}
              run={showing ? workedRun : null}
              playing={showing && playing}
              onPlaybackEnd={handlePlaybackEnd}
              onStepChange={(_, blockId) => setHighlightId(blockId)}
              reducedMotion={reducedMotion}
              ariaLabel={t("simLabel")}
            />
          </div>
          <div className="hidden shrink-0 items-center gap-2 px-3 pb-3 lg:flex">
            {actionButtons}
          </div>
        </section>

        <section
          aria-label={t("workspaceRegion")}
          className="relative flex min-h-0 flex-1 flex-col bg-surface"
        >
          {caption ? (
            <p
              // aria-live: the caption is the lesson's voice and it changes
              // when the beat does, so screen-reader students hear the new
              // instruction rather than having to go looking for it.
              aria-live="polite"
              className="shrink-0 px-3 pt-3 text-sm font-semibold leading-relaxed text-ink sm:px-4"
            >
              {caption}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 p-2 sm:p-3">
            {showing ? (
              <BlocklyWorkspace
                key="worked"
                payload={workedWorkspacePayload}
                initialWorkspaceJson={payload.workedExample.blocks}
                locale={blockLocale}
                rtl={locale === "ar"}
                readOnly
                onChange={() => {}}
                highlightBlockId={highlightId}
              />
            ) : (
              <BlocklyWorkspace
                key={`faded-${wsKey}`}
                payload={fadedWorkspacePayload}
                initialWorkspaceJson={payload.faded.blocks}
                locale={blockLocale}
                rtl={locale === "ar"}
                onChange={() => {
                  // Editing is its own answer to a wrong guess — clear the
                  // re-prompt the moment the student acts on it.
                  if (nudge) setNudge(null);
                }}
                ref={workspaceHandleRef}
              />
            )}
          </div>

          {nudge ? (
            <div
              role="status"
              className={cn(
                "mx-2 mb-2 flex shrink-0 items-start gap-2 rounded-lg border p-3 sm:mx-3 sm:mb-3",
                submission?.saveFailed
                  ? "border-danger/35 bg-surface-raised"
                  : "border-border-token bg-surface-sunken",
              )}
            >
              <span aria-hidden="true" className="text-lg leading-none">
                🧩
              </span>
              <p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-ink">
                {nudge}
              </p>
              {submission?.saveFailed ? (
                <Button size="sm" variant="secondary" onClick={handleRetrySave}>
                  {tLearn("retry")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {playing ? (
            <div aria-hidden="true" className="absolute inset-0 z-10 cursor-wait" />
          ) : null}
        </section>
      </div>

      {/* ── Mobile action bar (44px+ targets, fixed to the bottom edge) ── */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border-token bg-surface-raised p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        {actionButtons}
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
          onStart={() => {
            setPhase("show");
            setPlaying(true);
          }}
        />
      ) : null}

      {phase === "done" && submission ? (
        <LearnDoneOverlay
          explanation={intro.explanation}
          xpAwarded={submission.server ? submission.server.xpAwarded : null}
          saving={!submission.server && !submission.saveFailed}
          saveFailed={submission.saveFailed}
          onRetrySave={handleRetrySave}
          nextHref={nextHref}
        />
      ) : null}

      <HintDrawer
        open={hintOpen}
        onClose={() => setHintOpen(false)}
        hints={hints}
        lastRunAt={lastCheckAt}
        revealingTier={revealingTier}
        onReveal={(tier) => void handleRevealHint(tier)}
      />
    </div>
  );
}
