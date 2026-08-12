"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  classify,
  toTrainingExample,
  type ClassLabel,
  type LabelledSpecimen,
} from "@/modules/ai/knn";
import { Button, cn } from "@/ui";

import type { ActivityPlayerProps } from "../types";

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
  starCriteria: { threeStarMaxBlocks?: number };
}

/** Berry glyph: size drives diameter, colour drives hue (blue → red). */
function Berry({
  specimen,
  className,
}: {
  specimen: Specimen;
  className?: string;
}) {
  const px = 26 + Math.round(specimen.size * 26);
  // 250° (blue-violet) → 360° (red), deliberately NOT the short way round.
  // A plain 220→10 ramp passes through green and yellow, so mid-range
  // berries came out leaf-green — which reads as "safe" to a child no
  // matter which side of the rule they are on. Violet has no such baggage.
  const hue = Math.round(250 + specimen.color * 110);
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-full border-2 border-ink/15", className)}
      style={{
        width: px,
        height: px,
        background: `radial-gradient(circle at 32% 30%, hsl(${hue} 85% 72%), hsl(${hue} 70% 48%))`,
      }}
    />
  );
}

export function TeachPlayer({ intro, payload }: ActivityPlayerProps) {
  // Cast back at the registry boundary — see ActivityPlayerProps.payload.
  const data = payload as TeachPayload;
  const t = useTranslations("student.play.teach");

  const [assigned, setAssigned] = useState<Record<string, ClassLabel>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ verdict: string; correct?: number; total?: number } | null>(
    null,
  );

  const examples: LabelledSpecimen[] = useMemo(
    () =>
      data.pool
        .filter((s) => assigned[s.id])
        .map((s) => ({ ...s, label: assigned[s.id]! })),
    [data.pool, assigned],
  );

  const positives = examples.filter((e) => e.label === "positive").length;
  const negatives = examples.length - positives;
  const ready = positives >= data.minPerLabel && negatives >= data.minPerLabel;

  // Live guesses — the same function the server grades with.
  const guesses = useMemo(
    () => data.testSet.map((probe) => ({ probe, guess: classify(examples, probe) })),
    [data.testSet, examples],
  );

  const assign = (id: string, label: ClassLabel) => {
    if (result) return;
    setAssigned((prev) => (prev[id] === label ? omit(prev, id) : { ...prev, [id]: label }));
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
          answer: { examples: examples.map(toTrainingExample) },
        }),
      });
      if (!res.ok) {
        // A rejected submission is NOT a wrong answer. Saying "not quite
        // yet" here told a child to rethink work that never reached the
        // grader, which is how the .strict() 400 above stayed invisible.
        setResult({ verdict: "ERROR" });
        return;
      }
      const body = await res.json();
      // The counts ride on the feedback payload, not a top-level summary —
      // reading the wrong one is why this said "0 of 0" for every attempt.
      const feedbackData = body.feedback?.data as
        | { correct?: number; total?: number }
        | undefined;
      setResult({
        verdict: body.verdict,
        correct: feedbackData?.correct,
        total: feedbackData?.total,
      });
    } catch {
      setResult({ verdict: "ERROR" });
    } finally {
      setSubmitting(false);
    }
  };

  const unassigned = data.pool.filter((s) => !assigned[s.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
      <p className="text-sm text-ink-muted">{intro.instructions}</p>

      {/* Tray of berries still to teach with */}
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-bold text-ink">{t("trayHeading")}</h2>
        <p className="text-xs text-ink-muted">{t("trayHelp")}</p>
        <ul className="flex flex-wrap gap-3">
          {unassigned.map((s) => (
            <li
              key={s.id}
              className="flex w-24 flex-col items-center gap-1 rounded-xl border border-border-token bg-surface-raised p-2"
            >
              <Berry specimen={s} />
              {/* What ALREADY happened when the bunny ate it. Without this a
                  child has no way to know which berries are safe and the
                  whole activity collapses into guessing. */}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  s.truth === "positive"
                    ? "bg-brand/15 text-brand"
                    : "bg-danger/15 text-danger",
                )}
              >
                {s.truth === "positive" ? "😋" : "🤢"} {data.labels[s.truth]}
              </span>
              <button
                type="button"
                onClick={() => assign(s.id, s.truth)}
                className="w-full rounded-md bg-ink px-2 py-1 text-[11px] font-bold text-surface-raised"
              >
                {t("teachThis")}
              </button>
            </li>
          ))}
          {unassigned.length === 0 ? (
            <li className="text-sm text-ink-muted">{t("trayEmpty")}</li>
          ) : null}
        </ul>
      </section>

      {/* The two taught buckets */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(["positive", "negative"] as const).map((label) => (
          <section
            key={label}
            className={cn(
              "flex min-h-24 flex-col gap-2 rounded-xl border-2 border-dashed p-3",
              label === "positive" ? "border-brand/40 bg-brand/5" : "border-danger/40 bg-danger/5",
            )}
          >
            <h3 className="font-display text-sm font-bold text-ink">
              {data.labels[label]}{" "}
              <span className="font-normal text-ink-muted">
                ({label === "positive" ? positives : negatives})
              </span>
            </h3>
            <ul className="flex flex-wrap gap-2">
              {examples
                .filter((e) => e.label === label)
                .map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => assign(e.id, label)}
                      aria-label={t("removeExample")}
                      className="rounded-full p-0.5 transition-transform hover:scale-110"
                    >
                      <Berry specimen={e} />
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      {/* What the bunny currently thinks — the heart of the activity */}
      <section className="flex flex-col gap-2 rounded-xl border border-border-token bg-surface-raised p-3">
        <h2 className="font-display text-sm font-bold text-ink">
          <span aria-hidden className="me-1.5">
            🐰
          </span>
          {t("guessHeading")}
        </h2>
        <p className="text-xs text-ink-muted">{t("guessHelp")}</p>
        {!ready ? (
          <p className="text-sm text-ink-muted">
            {t("needMore", { count: data.minPerLabel })}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-4">
            {guesses.map(({ probe, guess }) => (
              <li key={probe.id} className="flex flex-col items-center gap-1">
                <span className="relative">
                  <Berry specimen={probe} />
                  <span
                    aria-hidden="true"
                    className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-surface-raised"
                  >
                    ?
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-bold",
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

      {result ? (
        <p
          role="status"
          className={cn(
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
              : typeof result.correct === "number" && typeof result.total === "number"
                ? t("missed", { correct: result.correct, total: result.total })
                : t("tryAgain")}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={submit} disabled={!ready} loading={submitting}>
          {t("check")}
        </Button>
        <span className="text-xs text-ink-muted">
          {t("taughtCount", { count: examples.length })}
        </span>
      </div>
    </div>
  );
}

function omit(source: Record<string, ClassLabel>, key: string) {
  const next = { ...source };
  delete next[key];
  return next;
}
