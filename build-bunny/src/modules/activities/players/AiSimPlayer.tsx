"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { getAiSimWidgetPlayer } from "@/modules/ai/lab/players/registry";
import { BoundaryScene } from "@/modules/ai/lab/players/BoundaryScene";
import { PixelScene } from "@/modules/ai/lab/players/PixelScene";
import { TrendScene } from "@/modules/ai/lab/players/TrendScene";
import { Badge, Button, cn, useReducedMotion } from "@/ui";

import { HintDrawer, type HintTierState } from "./shared/HintDrawer";
import { IntroOverlay } from "./shared/IntroOverlay";
import { ResultBanner } from "./shared/ResultBanner";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import type { ActivityPlayerProps, AiSimActivityPayload, AttemptResponse } from "../types";
import { resolveLocalized } from "../types";

/**
 * AI_SIM player (phase G): a thin wrapper, not a widget itself. It owns the
 * SAME submission chrome every other activity player uses (IntroOverlay,
 * SuccessOverlay, ResultBanner, HintDrawer, the top bar/action bar) and
 * delegates the actual interactive content to whichever widget component
 * `getAiSimWidgetPlayer(payload.widget.widgetId)` resolves — the client
 * mirror of how the server's AI_SIM engine (server/ai-sim.ts) delegates
 * grading to src/modules/ai/lab/registry.ts by widgetId. The widget reports
 * the child's actual work upward via onWorkChange; this component never
 * inspects or grades it — the POST body IS the work, unmodified, and the
 * server is the sole authority on the verdict (same rule as every engine).
 */

type Phase = "intro" | "edit" | "result";

interface Submission {
  id: string;
  answer: unknown;
  server: AttemptResponse | null;
  saveFailed: boolean;
}

export function AiSimPlayer({ intro, payload: rawPayload, revealHintAction }: ActivityPlayerProps) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as AiSimActivityPayload;
  const widgetId = payload.widget.widgetId;
  const Widget = getAiSimWidgetPlayer(widgetId);

  const t = useTranslations("student.play");
  const tSim = useTranslations("student.play.aiSim");
  const locale = useLocale();

  const beats = payload.walkthrough ?? null;
  // Opens on arrival when the level authored one. A child landing on an
  // abstract chart has no way to infer the rules, so the walkthrough is the
  // default state rather than a help button nobody presses (same reasoning
  // as Teach the Bunny, which needed exactly this).
  const [step, setStep] = useState(beats === null ? 0 : 1);
  const stepCount = beats?.length ?? 0;

  const [phase, setPhase] = useState<Phase>("intro");
  const [work, setWork] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
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

  const locked = phase === "result" || submitting;

  // Stable identity across renders (empty deps, functional setState) — the
  // widget below reports on every drag tick, so a fresh identity per render
  // would otherwise defeat the widgets' own useStableCallback guard.
  const handleWorkChange = useCallback((nextWork: unknown, nextReady: boolean) => {
    setWork(nextWork);
    setReady(nextReady);
  }, []);

  const submit = async (id: string, answer: unknown) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/levels/${intro.levelId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptRunId: id, answer }),
      });
      if (!response.ok) throw new Error(`attempt ${response.status}`);
      const data = (await response.json()) as AttemptResponse;
      setSubmission({ id, answer, server: data, saveFailed: false });
      setStarsBest((best) => Math.max(best, data.starsBest ?? 0));
      setLastSubmitAt(Date.now());
      setPhase("result");
    } catch {
      setSubmission({ id, answer, server: null, saveFailed: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!ready || work === null || submitting || phase === "result") return;
    void submit(crypto.randomUUID(), work);
  };

  const handleRetrySubmit = () => {
    if (!submission) return;
    void submit(submission.id, submission.answer);
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
  const introText = resolveLocalized(payload.intro, locale);
  const honestyNote = resolveLocalized(payload.honesty.note, locale);

  if (!Widget) {
    // Registry dispatch guarantees a known widgetId in practice; this is an
    // honest empty state, never a silent blank screen, if content drifts.
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-ink-muted">
        {tSim("unknownWidget")}
      </div>
    );
  }

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
              className={cn("text-lg leading-none", index < starsBest ? "text-accent" : "text-ink-faint")}
            >
              ★
            </span>
          ))}
        </span>
      </header>

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={payload.honesty.kind === "REAL" ? "positive" : "accent"}>
              {payload.honesty.kind === "REAL" ? tSim("honestyReal") : tSim("honestySimulated")}
            </Badge>
          </div>
          {introText ? <p className="text-sm leading-relaxed text-ink-muted">{introText}</p> : null}
          {honestyNote ? (
            <p className="rounded-lg bg-surface-sunken p-3 text-xs leading-relaxed text-ink-muted">
              {honestyNote}
            </p>
          ) : null}

          <Widget
            config={payload.widget}
            locale={locale}
            disabled={locked}
            reducedMotion={reducedMotion}
            onWorkChange={handleWorkChange}
          />

          {showFailure ? (
            <ResultBanner
              feedback={submission?.server?.feedback ?? { code: "runtimeError" }}
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
              {tSim("submitFailed")}
              <Button size="sm" variant="secondary" onClick={handleRetrySubmit}>
                {tSim("retry")}
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
          disabled={!ready || phase === "result"}
          className="min-w-0 flex-1 sm:flex-none sm:min-w-48"
        >
          {tSim("submit")}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setHintOpen(true)} disabled={phase === "result"}>
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

      {/* Walkthrough. One idea per beat, because a child meeting an abstract
          chart for the first time cannot hold four at once. The animation
          carries the meaning; the text only names what is already moving. */}
      {beats !== null && step > 0 ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4">
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-surface-raised p-6 shadow-overlay">
            {widgetId === "trend-line" ? <TrendScene step={step} /> : null}
            {widgetId === "boundary-builder" ? <BoundaryScene step={step} /> : null}
            {widgetId === "pixel-playground" ? <PixelScene step={step} /> : null}
            <h2 className="font-display text-xl font-bold text-ink">
              {resolveLocalized(beats[step - 1]!.title, locale)}
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              {resolveLocalized(beats[step - 1]!.body, locale)}
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5" aria-label={`${step} / ${stepCount}`}>
                {Array.from({ length: stepCount }, (_, i) => i + 1).map((n) => (
                  <span
                    key={n}
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      n === step ? "bg-brand" : "bg-ink/15",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  {tSim("walkSkip")}
                </Button>
                <Button onClick={() => setStep(step >= stepCount ? 0 : step + 1)}>
                  {step >= stepCount ? tSim("walkStart") : tSim("walkNext")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
