"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  DEFAULT_GLYPH_THEME,
  glyphFill,
  glyphPx,
  glyphShapeStyle,
  glyphTheme,
} from "@/modules/ai/glyph";
import { assign, lloydStep, tightness } from "@/modules/ai/grouping";
import { BunnyMascot, Button, cn, useReducedMotion } from "@/ui";

import { GroupScene } from "./GroupScene";
import { Walkthrough } from "./shared/Walkthrough";
import { HintDrawer } from "./shared/HintDrawer";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import { useDraftAutosave } from "./shared/useDraftAutosave";
import { useHints } from "./shared/useHints";
import styles from "./teach.module.css";

/**
 * The four beats this activity ships with when a level authors none. They
 * live in messages under walk1Title..walk4Body; a level that wants its own
 * script sets `walkthrough` in its payload and overrides all four.
 */
const BUILT_IN_BEATS = [1, 2, 3, 4] as const;

import type { ActivityPlayerProps, AttemptResponse } from "../types";
import { resolveLocalized, type GroupActivityPayload } from "../types";

/**
 * PATTERN_RECOGNITION player — "the Grouping Machine".
 *
 * The student places flags on a 2-D board of UNLABELLED specimens; every
 * specimen joins its nearest flag, and a meter shows how tight the piles
 * are — live, from the same shared implementation the grader replays, so
 * the meter and the verdict cannot disagree.
 *
 * Interaction rules carried over from TeachPlayer, for the same reasons:
 * CLICK to place and select (drag fails young hands on classroom trackpads
 * and is invisible to keyboards); arrow keys nudge the selected flag by
 * exactly the 0.01 grid step the wire format snaps to.
 *
 * On training levels the placed flags are only a SEED: pressing Run
 * animates the identical lloydStep the grader will replay, and the score
 * that counts is where the machine STOPS. The player keeps the child's
 * seed separate from the display markers so a re-run always starts from
 * what they actually placed.
 */

const GRID_STEP = 0.01;

const snap = (v: number) => Math.min(1, Math.max(0, Math.round(v / GRID_STEP) * GRID_STEP));
const round2 = (v: number) => Number(v.toFixed(2));

interface Marker {
  size: number;
  color: number;
}

/**
 * Rebuild a saved board, keeping only what this level can still accept.
 * A draft is the child's own work but still untrusted input from a past
 * session, so anything malformed degrades to an empty board rather than
 * throwing the player away on load.
 */
function restoreDraft(draft: unknown, data: GroupActivityPayload) {
  const empty = { seed: [] as Marker[], excluded: new Set<string>() };
  if (draft === null || typeof draft !== "object") return empty;
  const source = draft as { seed?: unknown; excluded?: unknown };

  const seed: Marker[] = Array.isArray(source.seed)
    ? source.seed
        .filter(
          (m): m is { size: number; color: number } =>
            typeof m === "object" &&
            m !== null &&
            typeof (m as { size?: unknown }).size === "number" &&
            typeof (m as { color?: unknown }).color === "number",
        )
        .slice(0, data.markers.max)
        .map((m) => ({ size: snap(m.size), color: snap(m.color) }))
    : [];

  const knownIds = new Set(data.specimens.map((specimen) => specimen.id));
  const excluded = new Set<string>(
    Array.isArray(source.excluded)
      ? source.excluded.filter((id): id is string => typeof id === "string" && knownIds.has(id))
      : [],
  );
  return { seed, excluded };
}

export function GroupPlayer({
  intro,
  payload,
  draft,
  revealHintAction,
  saveDraftAction,
}: ActivityPlayerProps) {
  // PATTERN_RECOGNITION levels had no hint drawer either — same fix as
  // TeachPlayer: authored hints were unreachable from the player.
  const hints = useHints(intro.levelId, intro.hintsUsedTiers, revealHintAction);
  // Cast back at the registry boundary — see ActivityPlayerProps.payload.
  const data = payload as GroupActivityPayload;
  const t = useTranslations("student.play.group");
  const tPlay = useTranslations("student.play");
  const locale = useLocale();

  const glyph = data.theme?.glyph ?? DEFAULT_GLYPH_THEME;
  const beats = data.walkthrough ?? BUILT_IN_BEATS.map((n) => ({
    title: t(`walk${n}Title`),
    body: t(`walk${n}Body`),
  }));

  const restored = useMemo(() => restoreDraft(draft, data), [draft, data]);

  const [step, setStep] = useState(1);
  const [seed, setSeed] = useState<Marker[]>(restored.seed);
  /** What the board shows: the seed, or the training run's current state. */
  const [display, setDisplay] = useState<Marker[]>(restored.seed);
  const [selected, setSelected] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(restored.excluded);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmitAt, setLastSubmitAt] = useState<number | null>(null);
  const [server, setServer] = useState<AttemptResponse | null>(null);
  const reducedMotion = useReducedMotion();
  const [result, setResult] = useState<{
    verdict: string;
    code?: string;
    data?: Record<string, unknown>;
  } | null>(null);
  const runTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (runTimer.current !== null) window.clearInterval(runTimer.current);
  }, []);

  const kept = useMemo(
    () => data.specimens.filter((s) => !excluded.has(s.id)),
    [data.specimens, excluded],
  );

  /** Which display marker each kept specimen belongs to (for the lines). */
  const ownership = useMemo(
    () => (display.length === 0 ? [] : kept.map((s) => assign(s, display))),
    [kept, display],
  );

  const score = useMemo(
    () => (display.length === 0 || kept.length === 0 ? null : tightness(kept, display)),
    [kept, display],
  );

  const frozen = result?.verdict === "PASS";

  // Placing and nudging markers is the work here; losing it to a sleeping
  // tablet costs the child the whole level. Stops once they have passed —
  // a finished attempt should not keep rewriting the draft behind the
  // celebration screen.
  useDraftAutosave(
    intro.levelId,
    { seed, excluded: [...excluded] },
    saveDraftAction,
    !frozen,
  );
  const scorePct = score === null ? null : Math.round(Math.max(0, score) * 100);
  const needPct = Math.round(data.objective.minTightness * 100);
  const countOk = seed.length >= data.markers.min && seed.length <= data.markers.max;
  // On training levels the meter previews the SEED score until Run is
  // pressed; the submit gate requires a run so the child never submits a
  // number they have not seen the machine settle on.
  const ready = countOk && kept.length > 0 && (!data.training || hasRun);

  const invalidate = () => {
    if (result) setResult(null);
    if (server) setServer(null);
    setHasRun(false);
  };

  /** Any edit to the board returns the display to the child's own seed. */
  const resetDisplayTo = (markers: Marker[]) => {
    setDisplay(markers);
  };

  const placeAt = (size: number, color: number) => {
    if (frozen || running) return;
    if (seed.length >= data.markers.max) return;
    const next = [...seed, { size: snap(size), color: snap(color) }];
    invalidate();
    setSeed(next);
    resetDisplayTo(next);
    setSelected(next.length - 1);
  };

  const removeFlag = (index: number) => {
    if (frozen || running) return;
    const next = seed.filter((_, i) => i !== index);
    invalidate();
    setSeed(next);
    resetDisplayTo(next);
    setSelected(null);
  };

  const nudge = (index: number, dSize: number, dColor: number) => {
    if (frozen || running) return;
    const next = seed.map((m, i) =>
      i === index
        ? { size: snap(m.size + dSize), color: snap(m.color + dColor) }
        : m,
    );
    invalidate();
    setSeed(next);
    resetDisplayTo(next);
  };

  const toggleExcluded = (id: string) => {
    if (frozen || running || data.maxExclusions === 0) return;
    invalidate();
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < data.maxExclusions) next.add(id);
      return next;
    });
  };

  /**
   * Animate the training loop: one visible step at a time, each computed by
   * the SAME lloydStep the grader replays from the seed. The animation is
   * the lesson — a child must be able to watch the flags walk.
   */
  const run = () => {
    if (!data.training || running || frozen || !countOk) return;
    invalidate();
    setRunning(true);
    let markers = [...seed];
    let iteration = 0;
    const iterations = data.training.iterations;
    const stepOnce = () => {
      const next = lloydStep(kept, markers);
      const moved = next.some(
        (m, i) => m.size !== markers[i]!.size || m.color !== markers[i]!.color,
      );
      markers = next;
      iteration += 1;
      setDisplay(next);
      if (!moved || iteration >= iterations) {
        if (runTimer.current !== null) window.clearInterval(runTimer.current);
        runTimer.current = null;
        setRunning(false);
        setHasRun(true);
      }
    };
    if (reducedMotion) {
      // No animation — jump straight to the fixed point, same arithmetic.
      while (iteration < iterations) {
        const next = lloydStep(kept, markers);
        const moved = next.some(
          (m, i) => m.size !== markers[i]!.size || m.color !== markers[i]!.color,
        );
        markers = next;
        iteration += 1;
        if (!moved) break;
      }
      setDisplay(markers);
      setRunning(false);
      setHasRun(true);
      return;
    }
    runTimer.current = window.setInterval(stepOnce, 700);
  };

  const submit = async () => {
    if (!ready || submitting || frozen) return;
    setSubmitting(true);
    // A real attempt unlocks the next hint tier without the 60s wait.
    setLastSubmitAt(Date.now());
    try {
      const res = await fetch(`/api/levels/${intro.levelId}/attempts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptRunId: crypto.randomUUID(),
          // The SEED is the answer — on training levels the grader replays
          // the loop itself. round2 mirrors the wire format's 0.01 grid.
          answer: {
            markers: seed.map((m) => ({ size: round2(m.size), color: round2(m.color) })),
            excluded: [...excluded],
          },
        }),
      });
      if (!res.ok) {
        setResult({ verdict: "ERROR" });
        return;
      }
      const body = (await res.json()) as AttemptResponse;
      setServer(body);
      setResult({
        verdict: body.verdict,
        code: body.feedback?.code,
        data: body.feedback?.data,
      });
    } catch {
      setResult({ verdict: "ERROR" });
    } finally {
      setSubmitting(false);
    }
  };

  const unlockedNow = server?.unlockedLevelIds ?? [];
  const nextHref =
    intro.nextLevel && (!intro.nextLevel.locked || unlockedNow.includes(intro.nextLevel.id))
      ? `/play/${intro.nextLevel.id}`
      : null;

  // The earned reveal: kind index per specimen id, only ever present on PASS.
  const revealed = result?.code === "kindsRevealed" ? (result.data as {
    kinds?: Record<string, number>;
    names?: unknown[];
  }) : null;

  const glyphDef = glyphTheme(glyph);

  return (
    <div className="relative flex h-dvh min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-token bg-surface-raised px-2 sm:px-4">
        <Link
          href="/adventure"
          aria-label={tPlay("backToMap")}
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
          aria-label={tPlay("starsBest", { stars: intro.starsBest, maxStars: intro.maxStars })}
          className="hidden items-center gap-0.5 sm:flex"
        >
          {Array.from({ length: intro.maxStars }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={cn(
                "text-lg leading-none",
                index < intro.starsBest ? "text-accent" : "text-ink-faint",
              )}
            >
              ★
            </span>
          ))}
        </span>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border-token bg-surface-raised px-3 text-sm font-bold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <span aria-hidden="true">💡</span>
          {t("howItWorks")}
        </button>
        <button
          type="button"
          onClick={() => hints.setOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border-token bg-surface-raised px-3 text-sm font-bold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <span aria-hidden="true">🧭</span>
          {tPlay("hint")}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1">
              <BunnyMascot state="idle" size="sm" />
            </span>
            <p
              className={cn(
                styles.bubble,
                "flex-1 rounded-2xl border border-border-token bg-surface-raised p-3 text-sm leading-relaxed text-ink-muted sm:p-4",
              )}
            >
              {intro.instructions}
            </p>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[1fr_minmax(16rem,20rem)]">
            {/* ── The board ── */}
            <section
              className={cn(
                styles.techPanel,
                "flex flex-col gap-3 rounded-xl border border-border-token bg-surface-raised p-3 sm:p-4",
              )}
            >
              <div
                className={cn(styles.gridLines, "relative aspect-square w-full overflow-hidden rounded-xl border border-border-token bg-surface")}
                onClick={(event) => {
                  // Clicks on flags/specimens stop propagation; a click that
                  // reaches the board itself places a new flag there.
                  const rect = event.currentTarget.getBoundingClientRect();
                  const size = (event.clientX - rect.left) / rect.width;
                  const colorFromTop = (event.clientY - rect.top) / rect.height;
                  placeAt(size, 1 - colorFromTop);
                }}
              >
                {/* Lines from each kept specimen to its owning flag. */}
                {display.length > 0 ? (
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {kept.map((s, i) => {
                      const m = display[ownership[i]!]!;
                      return (
                        <line
                          key={s.id}
                          x1={s.size * 100}
                          y1={(1 - s.color) * 100}
                          x2={m.size * 100}
                          y2={(1 - m.color) * 100}
                          stroke="currentColor"
                          strokeWidth="0.4"
                          className="text-ink/25"
                        />
                      );
                    })}
                  </svg>
                ) : null}

                {/* Specimens. Buttons only on exclusion levels. */}
                {data.specimens.map((s) => {
                  const isExcluded = excluded.has(s.id);
                  const px = glyphPx(glyphDef, s.size) * 0.7;
                  const kindIndex = revealed?.kinds?.[s.id];
                  const dot = (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "block border-2 border-ink/15",
                        isExcluded && "opacity-30 grayscale",
                      )}
                      style={{
                        width: px,
                        height: px,
                        background: glyphFill(glyphDef, s.color),
                        ...glyphShapeStyle(glyphDef),
                      }}
                    />
                  );
                  return (
                    <span
                      key={s.id}
                      className="absolute -translate-x-1/2 translate-y-1/2"
                      style={{ left: `${s.size * 100}%`, bottom: `${s.color * 100}%` }}
                    >
                      {data.maxExclusions > 0 ? (
                        <button
                          type="button"
                          aria-pressed={isExcluded}
                          aria-label={t(isExcluded ? "includeReading" : "excludeReading")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExcluded(s.id);
                          }}
                          className="relative block rounded-full"
                        >
                          {dot}
                          {isExcluded ? (
                            <span
                              aria-hidden="true"
                              className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-bold text-surface-raised"
                            >
                              ✗
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        dot
                      )}
                      {/* The earned reveal: a kind badge per specimen. */}
                      {kindIndex !== undefined && revealed?.names?.[kindIndex] !== undefined ? (
                        <span className="absolute start-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-1.5 text-[9px] font-bold text-surface-raised">
                          {resolveLocalized(revealed.names[kindIndex] as never, locale)}
                        </span>
                      ) : null}
                    </span>
                  );
                })}

                {/* Flags: the display markers. Selected flag takes arrow keys. */}
                {display.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={t("flagLabel", { n: i + 1 })}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selected === i) removeFlag(i);
                      else setSelected(i);
                    }}
                    onKeyDown={(e) => {
                      const d =
                        e.key === "ArrowLeft"
                          ? [-GRID_STEP, 0]
                          : e.key === "ArrowRight"
                            ? [GRID_STEP, 0]
                            : e.key === "ArrowUp"
                              ? [0, GRID_STEP]
                              : e.key === "ArrowDown"
                                ? [0, -GRID_STEP]
                                : null;
                      if (!d) return;
                      e.preventDefault();
                      nudge(i, d[0]!, d[1]!);
                    }}
                    className={cn(
                      "absolute grid size-8 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full text-lg transition-all duration-500",
                      selected === i && !running
                        ? "bg-brand/25 ring-2 ring-brand"
                        : "bg-transparent",
                    )}
                    style={{ left: `${m.size * 100}%`, bottom: `${m.color * 100}%` }}
                  >
                    <span aria-hidden="true">🚩</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-muted">
                {t("boardHelp", { max: data.markers.max })}
                {selected !== null && !running ? ` ${t("nudgeHelp")}` : ""}
              </p>
            </section>

            {/* ── Controls and the meter ── */}
            <div className="flex flex-col gap-4">
              <section
                className={cn(
                  styles.dotGrid,
                  "flex flex-col gap-3 rounded-xl border border-border-token bg-surface-raised p-3 sm:p-4",
                )}
              >
                <h2 className="font-display text-sm font-bold text-ink">{t("meterHeading")}</h2>
                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={scorePct ?? 0}
                  aria-label={t("meterHeading")}
                  className="relative h-5 overflow-hidden rounded-full bg-surface-sunken"
                >
                  <span
                    className="absolute inset-y-0 start-0 rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${scorePct ?? 0}%` }}
                  />
                  {/* The bar to clear. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 w-0.5 bg-ink/60"
                    style={{ insetInlineStart: `${needPct}%` }}
                  />
                </div>
                <p className="text-sm text-ink-muted">
                  {scorePct === null
                    ? t("meterEmpty")
                    : t("meterReading", { score: scorePct, need: needPct })}
                </p>
                <p className="text-xs text-ink-muted">
                  {t("flagCount", {
                    used: seed.length,
                    min: data.markers.min,
                    max: data.markers.max,
                  })}
                  {data.maxExclusions > 0
                    ? ` · ${t("excludedCount", { used: excluded.size, max: data.maxExclusions })}`
                    : ""}
                </p>
              </section>

              {data.training ? (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={run}
                  disabled={!countOk || running || frozen}
                  loading={running}
                >
                  <span aria-hidden="true" className="me-1.5">
                    ⚙️
                  </span>
                  {t("run")}
                </Button>
              ) : null}

              {result && result.verdict !== "PASS" ? (
                <p
                  key={result.code ?? result.verdict}
                  role="status"
                  className={cn(
                    styles.popIn,
                    "rounded-lg bg-accent/20 px-3 py-2 text-sm font-semibold text-warning",
                  )}
                >
                  {result.verdict === "ERROR"
                    ? t("submitFailed")
                    : result.code === "pilesNotTight"
                      ? t("pilesNotTight", {
                          score: (result.data?.score as number) ?? 0,
                          need: (result.data?.need as number) ?? needPct,
                        })
                      : result.code === "emptyMarker"
                        ? t("emptyMarker")
                        : result.code === "wrongMarkerCount"
                          ? t("wrongMarkerCount", {
                              min: data.markers.min,
                              max: data.markers.max,
                            })
                          : t("tryAgain")}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  onClick={submit}
                  disabled={!ready}
                  loading={submitting}
                  className={ready && !result && !submitting ? styles.pulseReady : undefined}
                >
                  {t("check")}
                </Button>
              </div>
              {data.training && !hasRun ? (
                <p className="text-xs text-ink-muted">{t("runFirst")}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Same anatomy as Teach the Bunny's, with the grouping scenes. */}
      <Walkthrough
        beats={beats}
        step={step}
        onStep={setStep}
        onDone={() => setStep(0)}
        renderScene={(beatStep) => <GroupScene step={beatStep} glyph={glyph} training={Boolean(data.training)} />}
      />

      {result?.verdict === "PASS" && server ? (
        <SuccessOverlay
          stars={server.stars}
          maxStars={intro.maxStars}
          xpAwarded={server.xpAwarded}
          explanation={intro.explanation}
          achievements={server.newAchievements.map((a) => ({
            slug: a.slug,
            icon: a.icon,
            name: resolveLocalized(a.name, locale) || a.slug,
          }))}
          worldCompletedName={
            server.worldCompleted ? resolveLocalized(server.worldCompleted.name, locale) : null
          }
          gradeMismatch={server.gradeMismatch}
          saving={false}
          saveFailed={false}
          onRetrySave={() => void submit()}
          improveNote={
            server.stars < intro.maxStars && data.starCriteria.threeStarMaxBlocks !== undefined
              ? t("improveFewerFlags", { max: data.starCriteria.threeStarMaxBlocks })
              : null
          }
          nextHref={nextHref}
          reducedMotion={reducedMotion}
          extra={
            <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-4">
              <div aria-hidden="true" className="flex items-end justify-center gap-2 text-2xl">
                <span>✨</span>
                <BunnyMascot state="celebrating" size="sm" />
                <span>✨</span>
              </div>
              <h2 className="font-display text-sm font-bold text-ink">{t("recapHeading")}</h2>
              <p className="text-sm text-ink-muted">
                {t("recapBody", {
                  flags: seed.length,
                  score: scorePct ?? 0,
                })}
              </p>
              {revealed?.names?.length ? (
                <p className="text-sm font-semibold text-brand">
                  {t("revealBanner", {
                    names: (revealed.names as never[])
                      .map((n) => resolveLocalized(n, locale))
                      .join(" · "),
                  })}
                </p>
              ) : null}
            </div>
          }
        />
      ) : null}

      <HintDrawer
        open={hints.open}
        onClose={() => hints.setOpen(false)}
        hints={hints.hints}
        lastRunAt={lastSubmitAt}
        revealingTier={hints.revealingTier}
        onReveal={(tier) => void hints.reveal(tier)}
      />
    </div>
  );
}
