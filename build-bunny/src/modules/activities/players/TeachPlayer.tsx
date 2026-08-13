"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  DEFAULT_GLYPH_THEME,
  glyphFill,
  glyphPx,
  glyphShapeStyle,
  glyphTheme,
} from "@/modules/ai/glyph";
import {
  nearest,
  toTrainingExample,
  type ClassLabel,
  type LabelledSpecimen,
} from "@/modules/ai/knn";
import { Button, cn } from "@/ui";

import { FeatureBoard } from "./FeatureBoard";
import { TeachRecap } from "./TeachRecap";
import { TeachScene } from "./TeachScene";
import { SuccessOverlay } from "./shared/SuccessOverlay";
import styles from "./teach.module.css";

import type { ActivityPlayerProps, AttemptResponse } from "../types";
import { resolveLocalized } from "../types";

/**
 * AI_CLASSIFICATION player — "Teach the Bunny".
 *
 * The student assigns berries to two buckets and watches the bunny's guesses
 * change as they do. Two deliberate choices:
 *
 *  - CLICK to assign, not drag. Young hands on classroom trackpads fail at
 *    drag-and-drop constantly, and click-to-assign is operable from a
 *    keyboard for free, which drag is not. Nothing here needs a pointer.
 *  - The guesses update LIVE. The moment the bunny gets one wrong is the
 *    whole lesson, and it has to happen while the student is still holding
 *    the idea — not after they press a button and wait for a server.
 *
 * Predictions shown here come from the same classifier the server grades
 * with (@/modules/ai/knn), so the bunny can never say one thing on screen
 * and another in the verdict.
 *
 * The bunny itself is a character on the board, not a mascot in the corner:
 * it breathes while idle, hops when taught, and shakes off a wrong answer.
 * Every reaction is tied to something the CHILD did, because an animation
 * that fires on its own schedule is decoration, and one that answers your
 * action is feedback.
 */

interface Specimen {
  id: string;
  size: number;
  color: number;
}

/** A pool berry: the bunny already tried it, so we know what happened. */
interface KnownSpecimen extends Specimen {
  truth: "positive" | "negative";
}

interface TeachPayload {
  conceptSlug: string;
  labels: { positive: string; negative: string };
  pool: KnownSpecimen[];
  testSet: Specimen[];
  minPerLabel: number;
  maxExamples?: number;
  theme?: {
    glyph: string;
    featureNames: { size: string; color: string };
    truthEmoji: { positive: string; negative: string };
  };
  walkthrough?: { title: string; body: string }[];
  board?: { show: boolean; showBoundary: boolean; axisLabels: { x: string; y: string } };
  holdout?: { min: number };
  passRule:
    | { kind: "allCorrect" }
    | { kind: "safetyFirst"; neverMisclassify: "positive" | "negative"; maxOtherErrors: number };
  starCriteria: { threeStarMaxBlocks?: number };
}

/** Specimen glyph: diameter is one feature, hue is the other. */
function Berry({
  specimen,
  className,
  theme = DEFAULT_GLYPH_THEME,
}: {
  specimen: Specimen;
  className?: string;
  theme?: string;
}) {
  const glyph = glyphTheme(theme);
  const px = glyphPx(glyph, specimen.size);
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 border-2 border-ink/15", className)}
      style={{
        width: px,
        height: px,
        background: glyphFill(glyph, specimen.color),
        ...glyphShapeStyle(glyph),
      }}
    />
  );
}

export function TeachPlayer({ intro, payload }: ActivityPlayerProps) {
  // Cast back at the registry boundary — see ActivityPlayerProps.payload.
  const data = payload as TeachPayload;
  const t = useTranslations("student.play.teach");
  const tPlay = useTranslations("student.play");
  const locale = useLocale();

  const [assigned, setAssigned] = useState<Record<string, ClassLabel>>({});
  // The student's OWN test pile (holdout levels): ids set aside, never
  // taught. Kept separate from `assigned` so a specimen physically cannot
  // be in both — moving it to one side removes it from the other.
  const [heldBack, setHeldBack] = useState<Set<string>>(new Set());
  // Opens on arrival. A child (or an adult) landing on an abstract board of
  // circles has no way to infer the rules, so the walkthrough is the default
  // state rather than a help button nobody presses.
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  // The full server response is kept so the celebration can report stars,
  // XP, achievements and the way on to the next level.
  const [server, setServer] = useState<AttemptResponse | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Bumped every time the bunny is taught something — remounting the bunny
  // span on this key is what retriggers the hop animation.
  const [hopKey, setHopKey] = useState(0);
  const [result, setResult] = useState<{
    verdict: string;
    code?: string;
    correct?: number;
    total?: number;
    missed?: string[];
    data?: Record<string, unknown>;
  } | null>(null);

  // Presentation, with the berry defaults every already-authored level relies
  // on. A level that sets none of this renders exactly as it did before.
  const glyph = data.theme?.glyph ?? DEFAULT_GLYPH_THEME;
  const truthEmoji = data.theme?.truthEmoji ?? { positive: "😋", negative: "🤢" };
  const beats = data.walkthrough ?? null;
  const stepCount = beats?.length ?? 4;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const examples: LabelledSpecimen[] = useMemo(
    () =>
      data.pool
        .filter((s) => assigned[s.id])
        .map((s) => ({ ...s, label: assigned[s.id]! })),
    [data.pool, assigned],
  );

  const positives = examples.filter((e) => e.label === "positive").length;
  const negatives = examples.length - positives;
  const atCap = data.maxExamples !== undefined && examples.length >= data.maxExamples;
  const holdOk = !data.holdout || heldBack.size >= data.holdout.min;
  const ready =
    positives >= data.minPerLabel &&
    negatives >= data.minPerLabel &&
    holdOk &&
    (data.maxExamples === undefined || examples.length <= data.maxExamples);

  // The self-score: the model's answers on the student's OWN test pile,
  // checked against those specimens' already-shipped truth, with the same
  // classifier the server uses. This is the first number in the product a
  // child sees before submitting — and the level's lesson is that a perfect
  // one can still lose, because a test YOU rigged proves nothing.
  const selfScore = useMemo(() => {
    if (!data.holdout || heldBack.size === 0 || examples.length === 0) return null;
    const held = data.pool.filter((s) => heldBack.has(s.id));
    let right = 0;
    for (const specimen of held) {
      if (nearest(examples, specimen)?.label === specimen.truth) right += 1;
    }
    return { right, total: held.length };
  }, [data.holdout, data.pool, heldBack, examples]);

  // Live guesses. We keep the MATCHED example, not just the label, because
  // "it looks most like this one you taught me" is the only form in which a
  // nearest-neighbour decision is explainable — and without it a wrong guess
  // is just an unexplained verdict a child cannot learn anything from.
  const guesses = useMemo(
    () =>
      data.testSet.map((probe) => {
        const match = nearest(examples, probe);
        return { probe, match, guess: match?.label ?? null };
      }),
    [data.testSet, examples],
  );

  const assign = (id: string, label: ClassLabel) => {
    // Frozen only once the bunny has actually got them all right. Freezing
    // on ANY result killed the entire feedback loop: a failed attempt tells
    // the child to "teach it a berry like the one it got wrong", and then
    // the board refused every click until they reloaded the page.
    if (result?.verdict === "PASS") return;
    // The hop must mirror what setAssigned actually does: only a click that
    // ADDS an example (not a removal, not one refused at the cap) may fire
    // it. A bunny that hops while nothing changed is lying to the child.
    const isRemoval = assigned[id] === label;
    const refused =
      !isRemoval &&
      !(id in assigned) &&
      data.maxExamples !== undefined &&
      Object.keys(assigned).length >= data.maxExamples;
    if (!isRemoval && !refused) setHopKey((k) => k + 1);
    // Teaching a specimen pulls it OUT of the test pile: one specimen, one
    // role, enforced physically rather than by an error message.
    if (!isRemoval && heldBack.has(id)) {
      setHeldBack((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    // Teaching something new invalidates the last verdict — leaving it on
    // screen would have the bunny reporting a score for a set of examples
    // it is no longer being shown.
    if (result) setResult(null);
    if (server) setServer(null);
    setAssigned((prev) => {
      if (prev[id] === label) return omit(prev, id);
      // Refuse at the cap rather than accepting the click and failing on
      // submit — a child who has to be told "no" by a server has already
      // lost the thread of what they were choosing between.
      if (data.maxExamples !== undefined && Object.keys(prev).length >= data.maxExamples) {
        return prev;
      }
      return { ...prev, [id]: label };
    });
  };

  const holdBack = (id: string) => {
    if (result?.verdict === "PASS") return;
    if (result) setResult(null);
    if (server) setServer(null);
    setHeldBack((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // One specimen, one role — see assign().
        setAssigned((a) => (a[id] ? omit(a, id) : a));
      }
      return next;
    });
  };

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/levels/${intro.levelId}/attempts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptRunId: crypto.randomUUID(),
          // Only the fields the route accepts. Pool specimens also carry
          // `truth` (what happened when the bunny ate it), and the route
          // schema is .strict(), so spreading the whole specimen made every
          // submission 400 — silently, because the failure surfaced as the
          // generic "not quite yet" line rather than an error.
          answer: {
            examples: examples.map(toTrainingExample),
            ...(data.holdout ? { checkSet: [...heldBack] } : {}),
          },
        }),
      });
      if (!res.ok) {
        // A rejected submission is NOT a wrong answer. Saying "not quite
        // yet" here told a child to rethink work that never reached the
        // grader, which is how the .strict() 400 above stayed invisible.
        setResult({ verdict: "ERROR" });
        return;
      }
      const body = (await res.json()) as AttemptResponse;
      setServer(body);
      // The counts ride on the feedback payload, not a top-level summary —
      // reading the wrong one is why this said "0 of 0" for every attempt.
      const feedbackData = body.feedback?.data as
        | { correct?: number; total?: number; missed?: string[]; used?: number; max?: number }
        | undefined;
      setResult({
        verdict: body.verdict,
        code: body.feedback?.code,
        correct: feedbackData?.correct,
        total: feedbackData?.total,
        missed: feedbackData?.missed,
        data: body.feedback?.data,
      });
    } catch {
      setResult({ verdict: "ERROR" });
    } finally {
      setSubmitting(false);
    }
  };

  const unassigned = data.pool.filter((s) => !assigned[s.id] && !heldBack.has(s.id));

  // Same rule as every other player: offer the next level only once it is
  // actually open — either it already was, or this very run unlocked it.
  const unlockedNow = server?.unlockedLevelIds ?? [];
  const nextHref =
    intro.nextLevel && (!intro.nextLevel.locked || unlockedNow.includes(intro.nextLevel.id))
      ? `/play/${intro.nextLevel.id}`
      : null;

  // The bunny's mood is derived, never scheduled: it shakes exactly when a
  // verdict other than PASS is on screen, hops exactly when taught, and
  // otherwise breathes. The changing key is what restarts the animation.
  const failed = result !== null && result.verdict !== "PASS";
  const bunnyKey = failed ? `shake-${hopKey}` : `hop-${hopKey}`;
  const bunnyClass = failed ? styles.shake : hopKey > 0 ? styles.hop : styles.bob;

  return (
    <div className="relative flex h-dvh min-h-0 flex-col">
      {/* ── Top bar: the same anatomy as every other player, so a child who
          has played ANY level already knows where the exit is. ── */}
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
      </header>

      {/* ── Board ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
          {/* The bunny hosts its own level: the instructions are its speech,
              and its body answers the child's actions — a hop for every
              example taught, a shake for a wrong verdict. */}
          <div className="flex items-start gap-3">
            <span
              key={bunnyKey}
              aria-hidden="true"
              className={cn(bunnyClass, "mt-1 text-4xl sm:text-5xl")}
            >
              🐰
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

          <div className="grid items-start gap-5 lg:grid-cols-2">
            {/* Left column: what the child controls. */}
            <div className="flex flex-col gap-5">
              {/* Tray of berries still to teach with */}
              <section className="flex flex-col gap-3">
                <StepHeading n={1} title={t("trayHeading")} help={t("trayHelp")} />
                <ul className="flex flex-wrap gap-3">
                  {unassigned.map((s) => (
                    <li
                      key={s.id}
                      className="flex w-32 flex-col items-center gap-2 rounded-xl border border-border-token bg-surface-raised p-3 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                    >
                      {/* Fixed-height berry row: berries differ in diameter by
                          design, and without this the cards ended up ragged and
                          the labels collided with the glyphs. */}
                      <span className="grid h-14 place-items-center">
                        <Berry specimen={s} theme={glyph} />
                      </span>
                      {/* What ALREADY happened when the bunny ate it. Without
                          this a child has no way to know which berries are safe
                          and the whole activity collapses into guessing. */}
                      <span
                        className={cn(
                          "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold",
                          s.truth === "positive"
                            ? "bg-brand/15 text-brand"
                            : "bg-danger/15 text-danger",
                        )}
                      >
                        {truthEmoji[s.truth]} {data.labels[s.truth]}
                      </span>
                      <button
                        type="button"
                        onClick={() => assign(s.id, s.truth)}
                        disabled={atCap}
                        className="w-full rounded-md bg-ink px-2 py-1.5 text-[11px] font-bold text-surface-raised transition-colors hover:bg-brand disabled:opacity-40 disabled:hover:bg-ink"
                      >
                        {t("teachThis")}
                      </button>
                      {data.holdout ? (
                        <button
                          type="button"
                          onClick={() => holdBack(s.id)}
                          className="w-full rounded-md border border-info/50 bg-info/10 px-2 py-1.5 text-[11px] font-bold text-info transition-colors hover:bg-info/20"
                        >
                          {t("keepForTesting")}
                        </button>
                      ) : null}
                    </li>
                  ))}
                  {unassigned.length === 0 ? (
                    <li className="text-sm text-ink-muted">{t("trayEmpty")}</li>
                  ) : null}
                </ul>
              </section>

              {/* The two taught buckets */}
              <section className="flex flex-col gap-3">
                <StepHeading n={2} title={t("bucketsHeading")} help={t("bucketsHelp")} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["positive", "negative"] as const).map((label) => (
                    <div
                      key={label}
                      className={cn(
                        "flex min-h-24 flex-col gap-2 rounded-xl border-2 border-dashed p-3",
                        label === "positive"
                          ? "border-brand/40 bg-brand/5"
                          : "border-danger/40 bg-danger/5",
                      )}
                    >
                      <h3 className="font-display text-sm font-bold text-ink">
                        {/* The basket the walkthrough animation already showed
                            them — the board speaks the same picture language. */}
                        <span aria-hidden="true" className="me-1">
                          🧺
                        </span>
                        {data.labels[label]}{" "}
                        <span className="font-normal text-ink-muted">
                          ({label === "positive" ? positives : negatives})
                        </span>
                      </h3>
                      <ul className="flex flex-wrap gap-2">
                        {examples
                          .filter((e) => e.label === label)
                          .map((e) => (
                            <li key={e.id} className={styles.popIn}>
                              <button
                                type="button"
                                onClick={() => assign(e.id, label)}
                                aria-label={t("removeExample")}
                                className="rounded-full p-0.5 transition-transform hover:scale-110"
                              >
                                <Berry specimen={e} theme={glyph} />
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              {/* The student's own test pile (holdout levels). */}
              {data.holdout ? (
                <section className="flex flex-col gap-3">
                  <StepHeading
                    n={3}
                    title={t("holdHeading")}
                    help={t("holdHelp", { min: data.holdout.min })}
                  />
                  <div className="flex min-h-20 flex-col gap-2 rounded-xl border-2 border-dashed border-info/50 bg-info/5 p-3">
                    <h3 className="font-display text-sm font-bold text-ink">
                      <span aria-hidden="true" className="me-1">
                        🔬
                      </span>
                      {t("holdCount", { used: heldBack.size, min: data.holdout.min })}
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {data.pool
                        .filter((s) => heldBack.has(s.id))
                        .map((s) => (
                          <li key={s.id} className={styles.popIn}>
                            <button
                              type="button"
                              onClick={() => holdBack(s.id)}
                              aria-label={t("removeFromHold")}
                              className="rounded-full p-0.5 transition-transform hover:scale-110"
                            >
                              <Berry specimen={s} theme={glyph} />
                            </button>
                          </li>
                        ))}
                    </ul>
                    {selfScore ? (
                      <p className="text-sm font-semibold text-ink">
                        {t("selfScore", { right: selfScore.right, total: selfScore.total })}
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>

            {/* Right column: what the machine does with it. */}
            <div className="flex flex-col gap-5">
              {/* The feature space. Optional per level: a tray is enough when
                  the lesson is "cover both kinds", but useless once the lesson
                  is about WHERE in the space your examples sit. */}
              {data.board?.show ? (
                <FeatureBoard
                  pool={data.pool}
                  testSet={data.testSet}
                  examples={examples}
                  assigned={assigned}
                  axisLabels={data.board.axisLabels}
                  showBoundary={data.board.showBoundary}
                  glyph={glyph}
                  missed={result?.missed ?? []}
                  onToggle={assign}
                  labels={data.labels}
                  disabled={result?.verdict === "PASS"}
                />
              ) : null}

              {/* What the bunny currently thinks — the heart of the activity.
                  This is the one panel where the MACHINE does the work, and
                  the lab dressing (corner brackets, dot matrix) marks exactly
                  that boundary and nothing else. */}
              {data.passRule.kind === "safetyFirst" ? (
                <section className="flex flex-col gap-2 rounded-xl border-2 border-warning/40 bg-accent/10 p-3">
                  <h2 className="font-display text-sm font-bold text-ink">
                    <span aria-hidden="true" className="me-1">
                      ⚠️
                    </span>
                    {t("safetyRule", {
                      danger: data.labels[data.passRule.neverMisclassify === "positive" ? "positive" : "negative"],
                      allowed: data.passRule.maxOtherErrors,
                    })}
                  </h2>
                  {result?.data && typeof result.data.dangerousMisses === "number" ? (
                    <div className="flex flex-wrap gap-2 text-sm font-semibold">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1",
                          (result.data.dangerousMisses as number) > 0
                            ? "bg-danger/15 text-danger"
                            : "bg-brand/15 text-brand",
                        )}
                      >
                        {t("dangerTally", { count: result.data.dangerousMisses as number })}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1",
                          (result.data.falseAlarms as number) > (data.passRule.maxOtherErrors ?? 0)
                            ? "bg-danger/15 text-danger"
                            : "bg-brand/15 text-brand",
                        )}
                      >
                        {t("alarmTally", {
                          count: result.data.falseAlarms as number,
                          max: data.passRule.maxOtherErrors,
                        })}
                      </span>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section
                className={cn(
                  styles.techPanel,
                  styles.dotGrid,
                  "flex flex-col gap-3 rounded-xl border border-border-token bg-surface-raised p-3 sm:p-4",
                )}
              >
                <StepHeading
                  n={data.holdout ? 4 : 3}
                  title={t("guessHeading")}
                  help={t("guessHelp")}
                />
                {!ready ? (
                  <p className="text-sm text-ink-muted">
                    {t("needMore", { count: data.minPerLabel })}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {guesses.map(({ probe, match, guess }) => (
                      <li
                        key={probe.id}
                        className="flex items-center gap-2 rounded-xl border border-border-token bg-surface p-3"
                      >
                        <span className="relative shrink-0">
                          <Berry specimen={probe} theme={glyph} />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute -end-1 -top-1 grid size-5 place-items-center rounded-full text-[11px] font-bold text-surface-raised",
                              result?.missed?.includes(probe.id) ? "bg-danger" : "bg-ink",
                            )}
                          >
                            {result?.missed?.includes(probe.id) ? "✗" : "?"}
                          </span>
                        </span>
                        {/* The reason, not just the verdict: the dashes drift
                            from the mystery berry to the taught berry it
                            copies, which is the 1-NN decision drawn as data
                            flow rather than asserted in prose. */}
                        {match ? (
                          <>
                            <span className={styles.flowLine} aria-hidden="true" />
                            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-muted">
                              <span>{t("looksLike")}</span>
                              <Berry specimen={match} theme={glyph} className="scale-75" />
                            </span>
                            <span className={styles.flowLine} aria-hidden="true" />
                          </>
                        ) : (
                          <span className="flex-1" />
                        )}
                        <span
                          key={`${probe.id}-${match?.id ?? "none"}-${guess ?? "none"}`}
                          className={cn(
                            styles.popIn,
                            "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold",
                            guess === "positive"
                              ? "bg-brand/15 text-brand"
                              : "bg-danger/15 text-danger",
                          )}
                        >
                          {guess ? data.labels[guess] : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {result ? (
            <p
              key={result.verdict}
              role="status"
              className={cn(
                styles.popIn,
                "rounded-lg px-3 py-2 text-sm font-semibold",
                result.verdict === "PASS"
                  ? "bg-brand/15 text-brand"
                  : "bg-accent/20 text-warning",
              )}
            >
              {result.verdict === "PASS"
                ? t("passed")
                : result.verdict === "ERROR"
                  ? t("submitFailed")
                  : result.code === "calledADangerousOneSafe"
                    ? t("calledADangerousOneSafe", {
                        danger:
                          data.labels[
                            data.passRule.kind === "safetyFirst" &&
                            data.passRule.neverMisclassify === "positive"
                              ? "positive"
                              : "negative"
                          ],
                      })
                    : result.code === "tooManyFalseAlarms"
                      ? t("tooManyFalseAlarms", {
                          max: data.passRule.kind === "safetyFirst" ? data.passRule.maxOtherErrors : 0,
                        })
                      : result.code === "needMoreHeldBack"
                        ? t("needMoreHeldBack", { need: data.holdout?.min ?? 0 })
                  : result.code === "tooManyExamples"
                    ? t("tooManyExamples", {
                        used: examples.length,
                        max: data.maxExamples ?? 0,
                      })
                    : typeof result.correct === "number" && typeof result.total === "number"
                      ? t("missed", { correct: result.correct, total: result.total })
                      : t("tryAgain")}
            </p>
          ) : null}

          <div className="flex items-center gap-3 pb-2">
            <Button
              size="lg"
              onClick={submit}
              disabled={!ready}
              loading={submitting}
              className={ready && !result && !submitting ? styles.pulseReady : undefined}
            >
              {t("check")}
            </Button>
            <span className="text-xs text-ink-muted">
              {data.maxExamples === undefined
                ? t("taughtCount", { count: examples.length })
                : t("capUsed", { used: examples.length, max: data.maxExamples })}
            </span>
          </div>
        </div>
      </div>

      {/* Walkthrough. Four beats, each naming ONE idea, because the activity
          is unguessable from a board of coloured circles — the first version
          shipped without this and neither children nor adults could tell what
          the game was asking of them. */}
      {step > 0 ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4">
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-surface-raised p-6 shadow-overlay">
            {/* The animation carries the explanation; the text only names
                what is already visible on screen above it. */}
            <TeachScene step={step} labels={data.labels} glyph={glyph} />
            <h2 className="font-display text-xl font-bold text-ink">
              {beats ? beats[step - 1]!.title : t(`walk${step}Title`)}
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              {beats ? beats[step - 1]!.body : t(`walk${step}Body`)}
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5" aria-label={`${step} / ${stepCount}`}>
                {Array.from({ length: stepCount }, (_, i) => i + 1).map((n) => (
                  <span
                    key={n}
                    aria-hidden="true"
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      n === step ? "bg-brand" : "bg-ink/15",
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  {t("walkSkip")}
                </Button>
                <Button onClick={() => setStep(step >= stepCount ? 0 : step + 1)}>
                  {step >= stepCount ? t("walkStart") : t("walkNext")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* The celebration, the receipt, and the way onward. */}
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
              ? t("improveFewer", { max: data.starCriteria.threeStarMaxBlocks })
              : null
          }
          nextHref={nextHref}
          reducedMotion={reducedMotion}
          extra={
            <TeachRecap
              examples={examples}
              testSet={data.testSet}
              labels={data.labels}
              glyph={glyph}
            />
          }
        />
      ) : null}
    </div>
  );
}

/**
 * Numbered section heading. The three parts of the board (pick berries →
 * they land in baskets → the bunny guesses) happen in a fixed order, and
 * without the numbers the page reads as three unrelated panels of circles.
 */
function StepHeading({ n, title, help }: { n: number; title: string; help: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-surface-raised ring-4 ring-brand/15"
      >
        {n}
      </span>
      <div className="flex flex-col">
        <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
        <p className="text-xs text-ink-muted">{help}</p>
      </div>
    </div>
  );
}

function omit(source: Record<string, ClassLabel>, key: string) {
  const next = { ...source };
  delete next[key];
  return next;
}
