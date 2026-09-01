"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button, cn, useReducedMotion } from "@/ui";

import { HintDrawer, type HintTierState } from "./shared/HintDrawer";
import { SequenceScene } from "./shared/SequenceScene";
import { IntroOverlay } from "./shared/IntroOverlay";
import { ResultBanner } from "./shared/ResultBanner";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import type {
  ActivityPlayerProps,
  AttemptResponse,
  SequencingActivityPayload,
} from "../types";
import { resolveLocalized } from "../types";

/**
 * SEQUENCING player (m4 task 4): the student reorders steps of a routine,
 * shuffled once server-side (deterministic per student+level). Reorder is
 * BOTH drag (native HTML5 DnD — mouse/trackpad) AND keyboard/touch (up/down
 * buttons, 44px targets) — drag-only is not acceptable, so the buttons are
 * the primary, always-visible affordance and an aria-live region announces
 * every move for screen-reader students. No local optimistic grading: the
 * POST response is the only verdict there ever is.
 */

type Phase = "intro" | "edit" | "result";

interface Submission {
  id: string;
  order: string[];
  server: AttemptResponse | null;
  saveFailed: boolean;
}

export function SequencingPlayer({
  intro,
  payload: rawPayload,
  revealHintAction,
}: ActivityPlayerProps) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as SequencingActivityPayload;

  const t = useTranslations("student.play");
  const tSeq = useTranslations("student.play.sequencing");
  const locale = useLocale();

  const [phase, setPhase] = useState<Phase>("intro");
  const [order, setOrder] = useState<string[]>(() => payload.items.map((item) => item.id));
  const [announcement, setAnnouncement] = useState("");
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
  const dragIndexRef = useRef<number | null>(null);

  const textById = useMemo(
    () => new Map(payload.items.map((item) => [item.id, resolveLocalized(item.text, locale)])),
    [payload.items, locale],
  );

  const locked = phase === "result" || submitting;

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return;
    const movedText = textById.get(order[from]!) ?? "";
    setOrder((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setAnnouncement(
      tSeq("moved", { item: movedText, position: to + 1, total: order.length }),
    );
  };

  const moveItem = (index: number, delta: number) => {
    if (locked) return;
    reorder(index, index + delta);
  };

  const handleDragStart = (index: number) => () => {
    if (locked) return;
    dragIndexRef.current = index;
  };
  const handleDragOver = (event: DragEvent<HTMLLIElement>) => {
    if (locked) return;
    event.preventDefault();
  };
  const handleDrop = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (locked) return;
    event.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null) return;
    reorder(from, index);
  };

  const handleReset = () => {
    if (locked) return;
    setOrder(payload.items.map((item) => item.id));
    setAnnouncement(tSeq("reset"));
  };

  const submit = async (id: string, submittedOrder: string[]) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/levels/${intro.levelId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptRunId: id, answer: { order: submittedOrder } }),
      });
      if (!response.ok) throw new Error(`attempt ${response.status}`);
      const data = (await response.json()) as AttemptResponse;
      setSubmission({ id, order: submittedOrder, server: data, saveFailed: false });
      setStarsBest((best) => Math.max(best, data.starsBest ?? 0));
      setLastSubmitAt(Date.now());
      setPhase("result");
    } catch {
      setSubmission({ id, order: submittedOrder, server: null, saveFailed: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (submitting || phase === "result") return;
    void submit(crypto.randomUUID(), order);
  };

  const handleRetrySubmit = () => {
    if (!submission) return;
    void submit(submission.id, submission.order);
  };

  const handleTryAgain = () => {
    setSubmission(null);
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
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <h2 className="font-display text-sm font-bold text-ink">{promptText}</h2>

          <div aria-live="polite" className="sr-only">
            {announcement}
          </div>

          <ol aria-label={promptText} className="flex flex-col gap-2">
            {order.map((id, index) => {
              const text = textById.get(id) ?? "";
              return (
                <li
                  key={id}
                  draggable={!locked}
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(index)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 border-border-token bg-surface-raised p-3",
                    !locked && "cursor-grab",
                  )}
                >
                  <span aria-hidden="true" className="select-none text-lg text-ink-faint">
                    ⠿
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-sm font-bold tabular-nums text-ink-muted"
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1 text-base leading-relaxed text-ink">{text}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={tSeq("moveUp", { item: text })}
                      onClick={() => moveItem(index, -1)}
                      disabled={locked || index === 0}
                      className="grid size-11 place-items-center rounded-md border border-border-token text-ink transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-40"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      aria-label={tSeq("moveDown", { item: text })}
                      onClick={() => moveItem(index, 1)}
                      disabled={locked || index === order.length - 1}
                      className="grid size-11 place-items-center rounded-md border border-border-token text-ink transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-40"
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          {showFailure ? (
            <ResultBanner
              feedback={submission?.server?.feedback ?? { code: "wrongOrder" }}
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
              {tSeq("submitFailed")}
              <Button size="lg" variant="secondary" onClick={handleRetrySubmit}>
                {tSeq("retry")}
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
          disabled={phase === "result"}
          className="min-w-0 flex-1 sm:flex-none sm:min-w-48"
        >
          {tSeq("submit")}
        </Button>
        <Button variant="secondary" size="lg" onClick={handleReset} disabled={locked}>
          {tSeq("resetOrder")}
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
          howScene={<SequenceScene />}
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
