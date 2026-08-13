"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { BlockLocale } from "@/modules/blockly/blocks";
import type { BlocklyWorkspaceHandle } from "@/modules/blockly/BlocklyWorkspace";
import { CodeView } from "@/modules/blockly/CodeView";
import SimulationCanvas from "@/modules/simulation/SimulationCanvas";
import { Button, cn, useReducedMotion } from "@/ui";

import { generateDisplayCode, runLocally, type LocalRunOutcome } from "./client-run";
import { HintDrawer, type HintTierState } from "./shared/HintDrawer";
import { IntroOverlay } from "./shared/IntroOverlay";
import { ResultBanner, useFeedbackText } from "./shared/ResultBanner";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import type {
  ActivityPlayerProps,
  AttemptResponse,
  GridActivityPayload,
} from "../types";
import { resolveLocalized } from "../types";

// Blockly renders into a real DOM — client-only by contract.
const BlocklyWorkspace = dynamic(
  () => import("@/modules/blockly/BlocklyWorkspace"),
  { ssr: false },
);

/**
 * The BLOCK_CODING/DEBUGGING player — the grid engine's registry entry (m4
 * task 4; formerly the standalone PlayerShell, moved here unchanged in
 * behavior). State machine (m3 pinned composition): intro → edit → running
 * (local engine playback + live block highlight, authoritative POST in
 * flight) → result (star burst / located failure). The client's own verdict
 * is only ever optimistic UI — stars, XP and unlocks all come from the
 * server response, reconciled quietly.
 */

type Phase = "intro" | "edit" | "running" | "result";

interface AttemptState {
  id: string;
  outcome: LocalRunOutcome;
  workspaceJson: unknown;
  server: AttemptResponse | null;
  saveFailed: boolean;
}

export function GridPlayer({
  intro,
  payload: rawPayload,
  revealHintAction,
  saveDraftAction,
}: ActivityPlayerProps) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as GridActivityPayload;

  const t = useTranslations("student.play");
  const feedbackText = useFeedbackText();
  const locale = useLocale();
  const blockLocale: BlockLocale = locale === "ar" ? "ar" : "en";

  const [phase, setPhase] = useState<Phase>("intro");
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [failStreak, setFailStreak] = useState(0);
  const [view, setView] = useState<"blocks" | "code">("blocks");
  const [codeSnapshot, setCodeSnapshot] = useState("");
  const [wsKey, setWsKey] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [starsBest, setStarsBest] = useState(intro.starsBest);
  const [hintOpen, setHintOpen] = useState(false);
  const [revealingTier, setRevealingTier] = useState<number | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
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
  const jsonRef = useRef<unknown>(payload.initialWorkspace);
  const saveTimerRef = useRef<number | null>(null);
  const editStartRef = useRef<number>(Date.now());

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null)
        window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  // ── Workspace plumbing ─────────────────────────────────────────────────

  const workspacePayload = useMemo(
    () => ({
      toolbox: payload.toolbox,
      startWorkspace: payload.resetWorkspace ?? undefined,
    }),
    [payload],
  );

  const handleWorkspaceChange = (json: Record<string, unknown>) => {
    jsonRef.current = json;
    // Autosave contract: 2s debounce after the last edit.
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveDraftAction({ levelId: intro.levelId, workspaceJson: json });
    }, 2000);
  };

  const currentJson = (): unknown =>
    workspaceHandleRef.current?.getWorkspaceJson() ??
    jsonRef.current ??
    payload.initialWorkspace ??
    {};

  const handleReset = () => {
    jsonRef.current = payload.resetWorkspace;
    setWsKey((key) => key + 1);
    setAttempt(null);
    setHighlightId(null);
    if (phase === "result") setPhase("edit");
    if (payload.resetWorkspace != null) {
      void saveDraftAction({
        levelId: intro.levelId,
        workspaceJson: payload.resetWorkspace,
      });
    }
  };

  const showCodeView = () => {
    try {
      setCodeSnapshot(generateDisplayCode(currentJson(), blockLocale));
    } catch {
      setCodeSnapshot("");
    }
    setView("code");
  };

  // ── Run / grade ────────────────────────────────────────────────────────

  const postAttempt = (
    id: string,
    workspaceJson: unknown,
    clientVerdict: "PASS" | "PARTIAL" | "FAIL",
    durationMs: number,
  ) => {
    fetch(`/api/levels/${intro.levelId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptRunId: id,
        workspaceJson,
        clientVerdict,
        durationMs,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`attempt ${response.status}`);
        return (await response.json()) as AttemptResponse;
      })
      .then((data) => {
        setAttempt((current) =>
          current && current.id === id
            ? { ...current, server: data, saveFailed: false }
            : current,
        );
        setStarsBest((best) => Math.max(best, data.starsBest ?? 0));
      })
      .catch(() => {
        setAttempt((current) =>
          current && current.id === id
            ? { ...current, saveFailed: true }
            : current,
        );
      });
  };

  const handleRun = () => {
    if (phase === "running") return;
    const json = currentJson();
    const maxHintTier = hints.reduce(
      (max, hint) => (hint.revealed ? Math.max(max, hint.tier) : max),
      0,
    );
    let outcome: LocalRunOutcome;
    try {
      outcome = runLocally(json, payload, blockLocale, maxHintTier);
    } catch {
      // Local codegen failure: skip playback, let the server be the judge.
      outcome = {
        runs: [],
        displayCode: "",
        verdict: "FAIL",
        stars: 0,
        qualityPassed: false,
        feedback: { code: "runtimeError" },
        playbackIndex: 0,
      };
    }
    const id = crypto.randomUUID();
    const durationMs = Date.now() - editStartRef.current;
    editStartRef.current = Date.now();
    setAttempt({ id, outcome, workspaceJson: json, server: null, saveFailed: false });
    setLastRunAt(Date.now());
    setHighlightId(null);
    setPhase(outcome.runs.length > 0 ? "running" : "result");
    postAttempt(id, json, outcome.verdict, durationMs);
  };

  const handlePlaybackEnd = () => {
    setHighlightId(null);
    setPhase("result");
    if (attempt?.outcome.verdict === "FAIL") setFailStreak((count) => count + 1);
    else setFailStreak(0);
  };

  const handleTryAgain = () => {
    setAttempt(null);
    setHighlightId(null);
    setPhase("edit");
  };

  const handleRetrySave = () => {
    if (!attempt) return;
    setAttempt({ ...attempt, saveFailed: false });
    postAttempt(attempt.id, attempt.workspaceJson, attempt.outcome.verdict, 0);
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
                  // Keep 0 for earlier-session reveals; stamp new ones so
                  // the next tier's cooldown starts now.
                  revealedAt: hint.revealed ? hint.revealedAt : Date.now(),
                  error: false,
                }
              : hint,
          ),
        );
      } else {
        setHints((current) =>
          current.map((hint) =>
            hint.tier === tier ? { ...hint, error: true } : hint,
          ),
        );
      }
    } catch {
      setHints((current) =>
        current.map((hint) =>
          hint.tier === tier ? { ...hint, error: true } : hint,
        ),
      );
    } finally {
      setRevealingTier(null);
    }
  };

  // Hints revealed in earlier sessions arrive as bare tier numbers — fetch
  // their text the first time the drawer opens.
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

  const displayVerdict = attempt
    ? (attempt.server?.verdict ?? attempt.outcome.verdict)
    : null;
  const showSuccess =
    phase === "result" &&
    attempt !== null &&
    (displayVerdict === "PASS" || displayVerdict === "PARTIAL");
  const showFailure = phase === "result" && attempt !== null && !showSuccess;

  const playbackRun = attempt
    ? (attempt.outcome.runs[attempt.outcome.playbackIndex] ?? null)
    : null;
  const variantIndex = attempt
    ? Math.min(attempt.outcome.playbackIndex, payload.variants.length - 1)
    : 0;
  const variant = payload.variants[variantIndex]!;

  const displayStars = attempt
    ? (attempt.server?.stars ?? attempt.outcome.stars)
    : 0;
  const resultFeedback = attempt
    ? (attempt.server?.feedback ?? attempt.outcome.feedback)
    : null;
  const unlockedNow = attempt?.server?.unlockedLevelIds ?? [];
  const nextHref =
    intro.nextLevel &&
    (!intro.nextLevel.locked || unlockedNow.includes(intro.nextLevel.id))
      ? `/play/${intro.nextLevel.id}`
      : null;
  const achievements = (attempt?.server?.newAchievements ?? []).map((a) => ({
    slug: a.slug,
    icon: a.icon,
    name: resolveLocalized(a.name, locale) || a.slug,
  }));
  const worldCompletedName = attempt?.server?.worldCompleted
    ? resolveLocalized(attempt.server.worldCompleted.name, locale)
    : null;

  const actionButtons = (
    <>
      <Button
        size="lg"
        onClick={handleRun}
        disabled={phase === "running"}
        className="min-w-0 flex-1 sm:flex-none sm:min-w-36"
      >
        <span aria-hidden="true">▶</span>
        {t(phase === "running" ? "running" : "run")}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={handleReset}
        disabled={phase === "running"}
      >
        {t("reset")}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => setHintOpen(true)}
        disabled={phase === "running"}
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
        <div
          role="group"
          aria-label={t("view.label")}
          className="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-border-token bg-surface-sunken p-1"
        >
          <button
            type="button"
            aria-pressed={view === "blocks"}
            onClick={() => setView("blocks")}
            className={cn(
              "h-9 rounded-md px-3 text-sm font-semibold transition-colors",
              view === "blocks"
                ? "bg-surface-raised text-ink shadow-soft"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {t("view.blocks")}
          </button>
          <button
            type="button"
            aria-pressed={view === "code"}
            onClick={showCodeView}
            className={cn(
              "h-9 rounded-md px-3 text-sm font-semibold transition-colors",
              view === "code"
                ? "bg-surface-raised text-ink shadow-soft"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {t("view.code")}
          </button>
        </div>
      </header>

      {/* ── Sim + workspace ── */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          aria-label={t("simRegion")}
          className="relative flex h-[42dvh] shrink-0 flex-col border-b border-border-token lg:h-auto lg:w-[42%] lg:shrink lg:border-b-0 lg:border-e"
        >
          <div className="relative min-h-0 flex-1 p-2 sm:p-3">
            {payload.variants.length > 1 ? (
              <span className="absolute start-4 top-4 z-10 rounded-full border border-border-token bg-surface-raised/85 px-2.5 py-1 text-xs font-bold text-ink-muted">
                {t("variantLabel", {
                  current: variantIndex + 1,
                  total: payload.variants.length,
                })}
              </span>
            ) : null}
            <SimulationCanvas
              variant={variant}
              theme={intro.worldTheme}
              run={playbackRun}
              playing={phase === "running"}
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
          className="relative min-h-0 flex-1 bg-surface"
        >
          <div className={view === "blocks" ? "h-full p-2 sm:p-3" : "hidden"}>
            <BlocklyWorkspace
              key={wsKey}
              payload={workspacePayload}
              initialWorkspaceJson={
                (wsKey === 0 ? payload.initialWorkspace : payload.resetWorkspace) ??
                undefined
              }
              locale={blockLocale}
              rtl={locale === "ar"}
              onChange={handleWorkspaceChange}
              highlightBlockId={highlightId}
              ref={workspaceHandleRef}
            />
          </div>
          {view === "code" ? (
            <div className="h-full overflow-y-auto p-3 sm:p-4">
              {codeSnapshot.trim().length > 0 ? (
                <CodeView code={codeSnapshot} />
              ) : (
                <p className="rounded-lg border border-border-token bg-surface-sunken p-4 text-sm text-ink-muted">
                  {t("codeEmpty")}
                </p>
              )}
            </div>
          ) : null}
          {phase === "running" ? (
            <div aria-hidden="true" className="absolute inset-0 z-10 cursor-wait" />
          ) : null}
        </section>

        {/* Located failure banner: over the sim panel, never over blocks. */}
        {showFailure ? (
          <div className="absolute bottom-0 start-0 end-0 z-20 p-3 lg:end-auto lg:w-[42%]">
            <ResultBanner
              feedback={resultFeedback}
              onTryAgain={handleTryAgain}
              showHintNudge={failStreak >= 2}
              onOpenHints={() => {
                setHintOpen(true);
              }}
            />
          </div>
        ) : null}
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
          worldTheme={intro.worldTheme}
          onStart={() => {
            editStartRef.current = Date.now();
            setPhase("edit");
          }}
        />
      ) : null}

      {showSuccess && attempt ? (
        <SuccessOverlay
          key={attempt.id}
          stars={displayStars}
          maxStars={intro.maxStars}
          xpAwarded={attempt.server ? attempt.server.xpAwarded : null}
          explanation={intro.explanation}
          achievements={achievements}
          worldCompletedName={worldCompletedName}
          gradeMismatch={attempt.server?.gradeMismatch ?? false}
          saving={!attempt.server && !attempt.saveFailed}
          saveFailed={attempt.saveFailed}
          onRetrySave={handleRetrySave}
          improveNote={
            displayStars < intro.maxStars && resultFeedback
              ? feedbackText(resultFeedback)
              : null
          }
          nextHref={nextHref}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <HintDrawer
        open={hintOpen}
        onClose={() => setHintOpen(false)}
        hints={hints}
        lastRunAt={lastRunAt}
        revealingTier={revealingTier}
        onReveal={(tier) => void handleRevealHint(tier)}
      />
    </div>
  );
}
