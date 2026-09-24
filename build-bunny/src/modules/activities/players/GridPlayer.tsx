"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { BlockLocale } from "@/modules/blockly/blocks";
import type {
  BlocklyWorkspaceHandle,
  WorkspaceEditState,
} from "@/modules/blockly/BlocklyWorkspace";
import { CodeView } from "@/modules/blockly/CodeView";
import { missingTrick, programBlocks, programShape } from "@/modules/blockly/serialization";
import SimulationCanvas from "@/modules/simulation/SimulationCanvas";
import { Button, Dialog, cn, useReducedMotion } from "@/ui";

import { PlayerSoundControls } from "@/modules/audio/AudioControls";
import { generateDisplayCode, runLocally, type LocalRunOutcome } from "./client-run";
import { BlockPalette } from "./shared/BlockPalette";
import { postAttempt as sendAttempt } from "./shared/attempt-outbox";
import {
  clearLocalDraft,
  currentDraftVersion,
  pruneLocalDrafts,
  readLocalDraft,
  recordDraftVersion,
  stableStringify,
  writeLocalDraft,
} from "./shared/local-draft";
import { GridScene } from "./shared/GridScene";
import { HintDrawer, type HintTierState } from "./shared/HintDrawer";
import { IntroOverlay } from "./shared/IntroOverlay";
import { MissionStrip } from "./shared/MissionStrip";
import { NextStepHint } from "./shared/NextStepHint";
import { RoboHelp, type HelpTopic, type RoboHelpFailure } from "./shared/RoboHelp";
import { ResultBanner, useFeedbackText } from "./shared/ResultBanner";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import { useGridSounds } from "./shared/useGridSounds";
import type {
  ActivityFeedback,
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

/**
 * Hooks for a player that wraps the grid player around its own first step —
 * the maze builder (CREATIVE_PROJECT) designs a map, then hands the grid
 * player a one-variant level. All optional; plain grid levels pass none.
 */
export interface GridPlayerHost {
  /** The wrapper showed the briefing itself: start editing right away. */
  skipIntro?: boolean;
  /** Extra fields sent with every attempt (the child's maze design). */
  attemptExtras?: Record<string, unknown>;
  /** Wraps the workspace JSON before any server draft save (design + program). */
  wrapDraft?: (workspaceJson: unknown) => unknown;
  /** The latest workspace JSON, on every edit. */
  onWorkspaceJson?: (workspaceJson: unknown) => void;
  /** One more build-toolbar action ("Change my maze"). */
  extraAction?: { label: string; onClick: () => void };
}

export function GridPlayer({
  intro,
  payload: rawPayload,
  revealHintAction,
  nextStepAction,
  saveDraftAction,
  skipIntro = false,
  attemptExtras,
  wrapDraft,
  onWorkspaceJson,
  extraAction,
}: ActivityPlayerProps & GridPlayerHost) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as GridActivityPayload;
  const wrap = wrapDraft ?? ((json: unknown) => json);
  // Offline, a draft save rejects; the work is already mirrored on this
  // device (local-draft), so a failed server copy must not surface as an
  // unhandled error. The next edit or reconnect saves it again.
  // The server draft version this device's mirror is based on; advanced by
  // every successful save from this page.
  // (Kept per page, so a grid remounted by the maze's Build keeps the
  // latest version rather than the one the page was rendered with.)
  const draftBaseRef = useRef<string | null>(
    currentDraftVersion({ playerKey: intro.playerKey, levelId: intro.levelId }, intro.draftVersion),
  );
  const noteSaved = (savedAt: unknown) => {
    if (savedAt === undefined || savedAt === null) return;
    const version = new Date(savedAt as string | Date).toISOString();
    draftBaseRef.current = version;
    recordDraftVersion({ playerKey: intro.playerKey, levelId: intro.levelId }, version);
  };
  const saveDraftQuietly = (input: { levelId: string; workspaceJson: unknown }) => {
    saveDraftAction(input)
      .then((result) => {
        if (result.ok) noteSaved((result.data as { savedAt?: unknown } | null)?.savedAt);
      })
      .catch(() => {});
  };

  const t = useTranslations("student.play");
  const feedbackText = useFeedbackText();
  const locale = useLocale();
  const blockLocale: BlockLocale = locale === "ar" ? "ar" : "en";

  const [phase, setPhase] = useState<Phase>(skipIntro ? "edit" : "intro");
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [failStreak, setFailStreak] = useState(0);
  const [view, setView] = useState<"blocks" | "code">("blocks");
  const [codeSnapshot, setCodeSnapshot] = useState("");
  // The workspace is (re)injected from `seed`: a new key with new JSON on
  // reset, or when a newer local draft is restored on mount.
  const [seed, setSeed] = useState<{ key: number; json: unknown }>({
    key: 0,
    json: payload.initialWorkspace,
  });
  const [editState, setEditState] = useState<WorkspaceEditState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Spoken confirmation for the tap-to-add path (screen reader, switch):
  // the palette closes on add, so without this nothing says it worked.
  const [addedAnnouncement, setAddedAnnouncement] = useState("");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  // Blocks were restored (server draft or this device's mirror).
  const [resumeDraft, setResumeDraft] = useState(
    () =>
      payload.initialWorkspace != null &&
      JSON.stringify(payload.initialWorkspace) !== JSON.stringify(payload.resetWorkspace ?? null),
  );
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [starsBest, setStarsBest] = useState(intro.starsBest);
  const [hintOpen, setHintOpen] = useState(false);
  const [revealingTier, setRevealingTier] = useState<number | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  // Pre-run coaching (empty / unsnapped program). Never graded, never posted.
  const [coach, setCoach] = useState<ActivityFeedback | null>(null);
  // First steps for a brand-new child: point at "Add block", then at Run,
  // then get out of the way for good (the first run ends it).
  const [attachedBlocks, setAttachedBlocks] = useState(
    () => programShape(payload.initialWorkspace ?? {}).attached,
  );
  const [firstRunDone, setFirstRunDone] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  // "Ask Robo Bunny": explain a block, why the run failed, a smaller hint,
  // a similar example — none of them the answer.
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);
  const [lastFailure, setLastFailure] = useState<RoboHelpFailure | null>(null);
  const openHelp = (topic: HelpTopic | null) => {
    setHelpTopic(topic);
    setHelpOpen(true);
  };
  const reducedMotion = useReducedMotion();
  const sounds = useGridSounds();
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
  // JSON edited since the last server save — what a pagehide flush sends.
  const unsavedRef = useRef<unknown>(null);
  const editStartRef = useRef<number>(Date.now());
  const draftKey = { playerKey: intro.playerKey, levelId: intro.levelId };

  // Exact resume: this device keeps a mirror of every edit (written on
  // change, no debounce). It wins only when the server still holds the
  // draft version the mirror was based on (nothing newer from another
  // tablet, and not cleared by a pass) and the mirror has edits the server
  // copy lacks — never because of a clock or key order.
  useEffect(() => {
    pruneLocalDrafts();
    const local = readLocalDraft(draftKey);
    if (local === null) return;
    if (local.base !== draftBaseRef.current) {
      clearLocalDraft(draftKey);
      return;
    }
    if (stableStringify(local.json) === stableStringify(payload.initialWorkspace ?? null)) return;
    const json = local.json;
    jsonRef.current = json;
    setSeed((current) => ({ key: current.key + 1, json }));
    setResumeDraft(true);
    if (intro.firstSteps) setAttachedBlocks(programShape(json ?? {}).attached);
    onWorkspaceJson?.(json);
    saveDraftQuietly({ levelId: intro.levelId, workspaceJson: wrap(json) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Leaving mid-debounce (tab closed, app switched, screen off) used to lose
  // the last edits: flush them with a keep-alive request the browser
  // finishes even as the page goes away.
  useEffect(() => {
    const flush = () => {
      if (unsavedRef.current === null) return;
      const body = JSON.stringify({ workspaceJson: wrap(unsavedRef.current) });
      unsavedRef.current = null;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      void fetch(`/api/levels/${intro.levelId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      })
        // A hidden tab usually lives on: record the new version, or offline
        // edits made after it would later look older than the server's copy.
        .then((response) => (response.ok ? (response.json() as Promise<{ savedAt?: unknown }>) : null))
        .then((data) => noteSaved(data?.savedAt))
        .catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wrap is stable per host
  }, [intro.levelId]);

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
    setCoach(null);
    if (intro.firstSteps) setAttachedBlocks(programShape(json).attached);
    writeLocalDraft(draftKey, json, draftBaseRef.current);
    onWorkspaceJson?.(json);
    unsavedRef.current = json;
    // Autosave contract: 2s debounce after the last edit.
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      unsavedRef.current = null;
      saveDraftQuietly({ levelId: intro.levelId, workspaceJson: wrap(json) });
    }, 2000);
  };

  const currentJson = (): unknown =>
    workspaceHandleRef.current?.getWorkspaceJson() ??
    jsonRef.current ??
    payload.initialWorkspace ??
    {};

  const doReset = () => {
    setResetConfirmOpen(false);
    jsonRef.current = payload.resetWorkspace;
    setSeed((current) => ({ key: current.key + 1, json: payload.resetWorkspace }));
    setAttempt(null);
    setHighlightId(null);
    setCoach(null);
    setLastFailure(null);
    clearLocalDraft(draftKey);
    unsavedRef.current = null;
    // A pending autosave of the old blocks must not land after the reset.
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (intro.firstSteps) setAttachedBlocks(programShape(payload.resetWorkspace ?? {}).attached);
    if (phase === "result") setPhase("edit");
    if (payload.resetWorkspace != null) {
      onWorkspaceJson?.(payload.resetWorkspace);
      saveDraftQuietly({
        levelId: intro.levelId,
        workspaceJson: wrap(payload.resetWorkspace),
      });
    }
  };

  // Reset throws away work, so it asks first — unless there is no work to
  // throw away, when asking would just be a speed bump.
  const handleReset = () => {
    const shape = programShape(currentJson());
    if (shape.attached + shape.loose === 0) doReset();
    else setResetConfirmOpen(true);
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
    sendAttempt(intro.playerKey, `/api/levels/${intro.levelId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptRunId: id,
        workspaceJson,
        clientVerdict,
        durationMs,
        ...attemptExtras,
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
        // A pass clears the server draft; the device copy goes with it.
        if (data.verdict === "PASS") clearLocalDraft({ playerKey: intro.playerKey, levelId: intro.levelId });
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
    // The two commonest first-run mistakes — Run on an empty program, and a
    // block dropped near "when start" without snapping on — used to run a
    // program that did nothing and report "Bunny finished away from the
    // burrow", which is true and teaches nothing. Explain the wiring instead,
    // and don't spend an attempt (or a teacher-visible failure) on it.
    const shape = programShape(json);
    if (shape.attached === 0) {
      setAttempt(null);
      setPhase("edit");
      setCoach({ code: shape.loose > 0 ? "looseBlocks" : "emptyProgram" });
      sounds.play("hint");
      return;
    }
    // "Do my trick" with no trick taught — same idea: explain, don't run.
    if (missingTrick(json)) {
      setAttempt(null);
      setPhase("edit");
      setCoach({ code: "noTrick" });
      sounds.play("hint");
      return;
    }
    setCoach(null);
    // A real run (not an empty-program nudge) ends the first-steps pointer.
    setFirstRunDone(true);
    sounds.play("run");
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
    if (attempt?.outcome.verdict === "FAIL") {
      const streak = failStreak + 1;
      setFailStreak(streak);
      // A younger child (support "extra") is shown a similar example after
      // two failed runs, without having to find the help button first.
      if (intro.support === "extra" && streak === 2) openHelp("example");
    } else {
      setFailStreak(0);
    }
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

  // The last failed run, explained in terms of the child's own program:
  // the located step from the engine's feedback, and the block that was
  // running then (the run's highlight entries map steps to block ids).
  // Kept as its own state — "Try again" clears the attempt, but the child
  // asks "why?" AFTER pressing it — and refreshed when the server verdict
  // lands. Reset clears it.
  useEffect(() => {
    if (phase !== "result" || !attempt || !resultFeedback || displayVerdict === "PASS") return;
    const run = attempt.outcome.runs[attempt.outcome.playbackIndex] ?? null;
    const rawStep = resultFeedback.data?.step;
    const step = typeof rawStep === "number" ? rawStep : null;
    let block: RoboHelpFailure["block"] = null;
    if (run && step !== null) {
      const active = run.highlights
        .filter((entry) => entry.step <= step)
        .sort((a, b) => b.step - a.step)[0];
      const found = active
        ? programBlocks(attempt.workspaceJson).find((b) => b.id === active.blockId)
        : undefined;
      if (found) block = { index: found.index, type: found.type };
    }
    setLastFailure({ feedback: resultFeedback, step, block });
    // resultFeedback/displayVerdict derive from `attempt`, which is the
    // identity that actually changes (client run, then server reply).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, attempt]);

  const tourStep: "add" | "run" | null =
    intro.firstSteps && !firstRunDone && phase === "edit" && view === "blocks"
      ? attachedBlocks === 0
        ? "add"
        : "run"
      : null;
  const tourRing = "ring-4 ring-accent ring-offset-2 ring-offset-surface motion-safe:animate-pulse";

  const actionButtons = (
    <>
      <Button
        variant="go"
        size="lg"
        onClick={handleRun}
        disabled={phase === "running"}
        className={cn("min-w-0 flex-1 sm:flex-none sm:min-w-36", tourStep === "run" && tourRing)}
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
        onClick={() => openHelp(null)}
        disabled={phase === "running"}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">💡</span>
        {t("help.open")}
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
        <div
          role="group"
          aria-label={t("view.label")}
          className="flex shrink-0 items-center overflow-hidden rounded-lg border border-border-token bg-surface-sunken"
        >
          <button
            type="button"
            aria-pressed={view === "blocks"}
            onClick={() => setView("blocks")}
            className={cn(
              // The segments ARE the touch targets, so they carry the 44px
              // minimum themselves and the control sizes around them.
              "h-11 px-3 text-sm font-semibold transition-colors",
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
              // The segments ARE the touch targets, so they carry the 44px
              // minimum themselves and the control sizes around them.
              "h-11 px-3 text-sm font-semibold transition-colors",
              view === "code"
                ? "bg-surface-raised text-ink shadow-soft"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {t("view.code")}
          </button>
        </div>
      </header>

      {phase !== "intro" ? (
        <MissionStrip
          objective={intro.objective}
          onShow={() => setBriefingOpen(true)}
        />
      ) : null}

      {/* ── Sim + workspace ── */}
      <div className="relative flex min-h-0 flex-1 flex-col split:flex-row">
        <section
          aria-label={t("simRegion")}
          className="relative flex h-[38dvh] shrink-0 flex-col border-b border-border-token split:h-auto split:w-[42%] split:min-w-[22rem] split:shrink-0 split:border-b-0 split:border-e"
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
              onEvent={sounds.onEvent}
              reducedMotion={reducedMotion}
              ariaLabel={t("simLabel")}
            />
          </div>
          <div className="hidden shrink-0 flex-wrap items-center gap-2 px-3 pb-3 split:flex">
            {actionButtons}
          </div>
        </section>

        <section
          aria-label={t("workspaceRegion")}
          className="relative min-h-0 flex-1 bg-surface"
        >
          <div
            className={
              view === "blocks" ? "flex h-full flex-col gap-2 p-2 sm:p-3" : "hidden"
            }
          >
            {/* Build tools: tap-to-add (the no-drag path), undo, redo, delete.
                A strip in normal flow above the canvas — never floating over
                it, where it covered the "when start" block. */}
            <div
              role="toolbar"
              aria-label={t("tools.addBlock")}
              className="flex shrink-0 flex-wrap items-center justify-end gap-1"
            >
              {tourStep ? (
                <p
                  role="status"
                  className="me-auto flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-2 text-sm font-semibold text-ink"
                >
                  <span aria-hidden="true">👉</span>
                  {t(tourStep === "add" ? "firstSteps.add" : "firstSteps.run")}
                </p>
              ) : null}
              {extraAction ? (
                <button
                  type="button"
                  onClick={extraAction.onClick}
                  disabled={phase === "running"}
                  className="me-auto inline-flex h-11 items-center gap-1 rounded-lg border border-border-token bg-surface-raised px-3 text-sm font-bold text-ink hover:bg-surface-sunken disabled:opacity-40"
                >
                  <span aria-hidden="true">🧱</span>
                  {extraAction.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-haspopup="dialog"
                className={cn(
                  "inline-flex h-11 items-center gap-1 rounded-lg bg-brand px-3 text-sm font-bold text-on-brand hover:bg-brand-strong",
                  tourStep === "add" && tourRing,
                )}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  +
                </span>
                {t("tools.addBlock")}
              </button>
              {nextStepAction ? (
                <NextStepHint
                  levelId={intro.levelId}
                  action={nextStepAction}
                  usedBefore={intro.hintsUsedTiers.includes(5)}
                  readyAction={`“${t("run")}”`}
                  disabled={phase === "running"}
                  getState={() => ({
                    workspaceJson: workspaceHandleRef.current?.getWorkspaceJson() ?? {},
                    ...(attemptExtras ?? {}),
                  })}
                  onStep={(step) => {
                    // Point at what the hint names, so "+ Add block" lands
                    // exactly where it said.
                    const handle = workspaceHandleRef.current;
                    if (!handle) return;
                    if (step.code === "addBlock" || step.code === "moveBlock") {
                      const place = step.place;
                      if (step.code === "moveBlock") handle.selectFor({ kind: "index", index: step.index });
                      else
                        handle.selectFor(
                          place.kind === "start"
                            ? { kind: "hat" }
                            : place.kind === "newTrick"
                              ? { kind: "none" }
                              : place.kind === "insideTrick"
                                ? { kind: "trick" }
                                : { kind: "index", index: place.index },
                        );
                    } else if (
                      (step.code === "removeBlock" || step.code === "changeBlock" || step.code === "setNumber") &&
                      step.index > 0
                    ) {
                      handle.selectFor({ kind: "index", index: step.index });
                    }
                  }}
                />
              ) : null}
              <ToolButton
                label={t("tools.undo")}
                disabled={!editState?.canUndo}
                onClick={() => workspaceHandleRef.current?.undo()}
                icon={<path d="M9 14 4 9l5-5" />}
                extra={<path d="M4 9h10a6 6 0 0 1 0 12h-3" />}
              />
              <ToolButton
                label={t("tools.redo")}
                disabled={!editState?.canRedo}
                onClick={() => workspaceHandleRef.current?.redo()}
                icon={<path d="m15 14 5-5-5-5" />}
                extra={<path d="M20 9H10a6 6 0 0 0 0 12h3" />}
              />
              <ToolButton
                label={t("tools.deleteBlock")}
                disabled={!editState?.selected}
                onClick={() => {
                  if (workspaceHandleRef.current?.deleteSelected()) sounds.play("remove");
                }}
                icon={<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />}
              />
            </div>
            <div className="min-h-0 flex-1">
              <BlocklyWorkspace
                key={seed.key}
                payload={workspacePayload}
                initialWorkspaceJson={seed.json ?? undefined}
                locale={blockLocale}
                rtl={locale === "ar"}
                onChange={handleWorkspaceChange}
                onBlockGesture={sounds.onBlockGesture}
                onEditState={setEditState}
                highlightBlockId={highlightId}
                ref={workspaceHandleRef}
              />
            </div>
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
        {coach && !showFailure ? (
          <div className="absolute bottom-0 start-0 end-0 z-20 p-3 split:bottom-14 split:end-auto split:w-[42%] split:min-w-[22rem]">
            <ResultBanner
              tone="coach"
              feedback={coach}
              onTryAgain={() => setCoach(null)}
              showHintNudge={false}
              onOpenHints={() => setHintOpen(true)}
            />
          </div>
        ) : null}
        {showFailure ? (
          <div className="absolute bottom-0 start-0 end-0 z-20 p-3 split:bottom-14 split:end-auto split:w-[42%] split:min-w-[22rem]">
            <ResultBanner
              feedback={resultFeedback}
              onTryAgain={handleTryAgain}
              showHintNudge={failStreak >= 2}
              onOpenHints={() => openHelp("hint")}
              onWhy={() => openHelp("why")}
              whyLabel={t("help.whyFailed")}
            />
          </div>
        ) : null}
      </div>

      {/* ── Mobile action bar (44px+ targets, fixed to the bottom edge) ── */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border-token bg-surface-raised p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] split:hidden">
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
          ageBand={intro.ageBand}
          worldTheme={intro.worldTheme}
          howScene={<GridScene />}
          resumeDraft={resumeDraft}
          onStart={() => {
            editStartRef.current = Date.now();
            setPhase("edit");
          }}
        />
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {addedAnnouncement}
      </p>

      <BlockPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        toolbox={payload.toolbox}
        editState={editState}
        onAdd={(type) => {
          const added = workspaceHandleRef.current?.addBlock(type) ?? false;
          if (added) {
            sounds.play("place");
            setAddedAnnouncement(
              t("tools.added", { block: t.has(`blockNames.${type}`) ? t(`blockNames.${type}`) : type }),
            );
          }
          return added;
        }}
      />

      {resetConfirmOpen ? (
        <Dialog
          open
          onClose={() => setResetConfirmOpen(false)}
          title={t("tools.resetTitle")}
          closeLabel={t("tools.close")}
          footer={
            <>
              <Button variant="secondary" size="lg" onClick={() => setResetConfirmOpen(false)}>
                {t("tools.resetCancel")}
              </Button>
              <Button variant="danger" size="lg" onClick={doReset}>
                {t("tools.resetConfirm")}
              </Button>
            </>
          }
        >
          <p className="text-base text-ink">{t("tools.resetBody")}</p>
        </Dialog>
      ) : null}

      {briefingOpen ? (
        <IntroOverlay
          reopened
          title={intro.title}
          story={intro.story}
          objective={intro.objective}
          instructions={intro.instructions}
          difficulty={intro.difficulty}
          estimatedMinutes={intro.estimatedMinutes}
          ageBand={intro.ageBand}
          howScene={<GridScene />}
          onStart={() => setBriefingOpen(false)}
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
          worldPower={attempt.server?.worldCompleted?.power ?? null}
          gradeMismatch={attempt.server?.gradeMismatch ?? false}
          saving={!attempt.server && !attempt.saveFailed}
          saveFailed={attempt.saveFailed}
          onRetrySave={handleRetrySave}
          improveNote={
            displayStars < intro.maxStars && resultFeedback
              ? feedbackText(resultFeedback)
              : null
          }
          stretchNote={
            intro.support === "stretch" && displayStars >= intro.maxStars
              ? t("success.stretch")
              : null
          }
          onReplay={handleTryAgain}
          certificate={attempt?.server?.certificate ?? null}
          nextHref={nextHref}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <RoboHelp
        open={helpOpen}
        initialTopic={helpTopic}
        onClose={() => setHelpOpen(false)}
        worldTheme={intro.worldTheme}
        tags={intro.tags}
        selectedBlockType={editState?.selected?.type ?? null}
        lastFailure={lastFailure}
        hints={hints}
        revealingTier={revealingTier}
        onRevealTier1={() => void handleRevealHint(1)}
        onOpenHints={() => {
          setHelpOpen(false);
          setHintOpen(true);
        }}
      />

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

/** 44px icon button for the build toolbar; the label is the accessible name. */
function ToolButton({
  label,
  disabled,
  onClick,
  icon,
  extra,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-sunken disabled:opacity-40"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 rtl:-scale-x-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
        {extra}
      </svg>
    </button>
  );
}
