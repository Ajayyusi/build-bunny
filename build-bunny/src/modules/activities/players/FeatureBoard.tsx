"use client";

import { useMemo } from "react";

import { glyphFill, glyphPx, glyphTheme, MYSTERY_FILL } from "@/modules/ai/glyph";
import { classify, nearest, type LabelledSpecimen } from "@/modules/ai/knn";
import { cn } from "@/ui";

/**
 * The feature space, drawn.
 *
 * A wrapped row of circles hides the one thing this whole activity is about:
 * specimens live at COORDINATES, and a nearest-neighbour model answers a new
 * one by reaching for whichever taught point is closest. In a tray that is an
 * assertion the child has to take on faith. On a board they can see it —
 * where their examples sit, where the gaps are, and which side of the space
 * they never taught anything in.
 *
 * Read-only by design. The dots are a second click target for the assignment
 * the child can already make from the tray; nothing is dragged. Classroom
 * tablets make drag-and-drop a coordination test rather than a thinking one,
 * which is the same reason the tray uses click.
 *
 * The optional prediction tint is computed with the SAME classify() the
 * server grades with, over a coarse grid. It leaks nothing: every pixel of it
 * is a consequence of examples the student chose themselves.
 */

interface Specimen {
  id: string;
  size: number;
  color: number;
}
interface PoolSpecimen extends Specimen {
  truth: "positive" | "negative";
}

/** Coarse enough to stay cheap, fine enough that the boundary reads as a line. */
const TINT_STEPS = 24;

export function FeatureBoard({
  pool,
  testSet,
  examples,
  assigned,
  axisLabels,
  showBoundary,
  glyph,
  missed,
  onToggle,
  labels,
  disabled,
}: {
  pool: PoolSpecimen[];
  testSet: Specimen[];
  examples: LabelledSpecimen[];
  assigned: Record<string, "positive" | "negative">;
  axisLabels: { x: string; y: string };
  showBoundary: boolean;
  glyph: string;
  /** Test specimens the grader said the model got wrong, if it has spoken. */
  missed: string[];
  onToggle: (id: string, label: "positive" | "negative") => void;
  labels: { positive: string; negative: string };
  disabled: boolean;
}) {
  const theme = glyphTheme(glyph);

  // One cell per TINT_STEPS², recomputed only when the taught set changes.
  const tint = useMemo(() => {
    if (!showBoundary || examples.length === 0) return null;
    const cells: ("positive" | "negative" | null)[] = [];
    for (let row = 0; row < TINT_STEPS; row += 1) {
      for (let col = 0; col < TINT_STEPS; col += 1) {
        cells.push(
          classify(examples, {
            // Cell centres, so no sample sits exactly on an axis edge.
            size: (col + 0.5) / TINT_STEPS,
            color: (row + 0.5) / TINT_STEPS,
          }),
        );
      }
    }
    return cells;
  }, [showBoundary, examples]);

  const missedSet = new Set(missed);

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        {/* Y axis caption, reading bottom-to-top like the axis it labels. */}
        <span
          className="grid place-items-center text-[11px] font-bold text-ink-muted"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {axisLabels.y}
        </span>

        <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-xl border border-border-token bg-surface">
          {tint ? (
            <div
              aria-hidden="true"
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${TINT_STEPS}, 1fr)`,
                gridTemplateRows: `repeat(${TINT_STEPS}, 1fr)`,
              }}
            >
              {tint.map((cell, i) => (
                <span
                  key={i}
                  className={cn(
                    cell === "positive"
                      ? "bg-brand/20"
                      : cell === "negative"
                        ? "bg-danger/20"
                        : "",
                  )}
                />
              ))}
            </div>
          ) : null}

          {/* Held-out specimens: plotted, never taught with. */}
          {testSet.map((probe) => {
            const guess = nearest(examples, probe);
            const px = glyphPx(theme, probe.size);
            return (
              <span
                key={probe.id}
                title={probe.id}
                className="absolute grid -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-ink/50"
                style={{
                  left: `${probe.size * 100}%`,
                  bottom: `${probe.color * 100}%`,
                  width: px,
                  height: px,
                  background: MYSTERY_FILL,
                }}
              >
                <span
                  aria-hidden="true"
                  className="text-[11px] font-bold text-ink"
                >
                  {missedSet.has(probe.id) ? "✗" : guess ? "?" : "?"}
                </span>
              </span>
            );
          })}

          {/* Pool specimens. Clicking one teaches with it, exactly as the
              tray button does — the board never becomes a second mechanic. */}
          {pool.map((specimen) => {
            const px = glyphPx(theme, specimen.size);
            const taught = assigned[specimen.id];
            return (
              <button
                key={specimen.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(specimen.id, specimen.truth)}
                aria-label={`${specimen.id}: ${labels[specimen.truth]}`}
                className={cn(
                  "absolute -translate-x-1/2 translate-y-1/2 rounded-full border-2 transition-transform",
                  taught ? "border-ink shadow-md" : "border-ink/15 opacity-60",
                  disabled ? "" : "hover:scale-110",
                )}
                style={{
                  left: `${specimen.size * 100}%`,
                  bottom: `${specimen.color * 100}%`,
                  width: px,
                  height: px,
                  background: glyphFill(theme, specimen.color),
                }}
              />
            );
          })}
        </div>
      </div>

      <figcaption className="ps-6 text-[11px] font-bold text-ink-muted">
        {axisLabels.x} →
      </figcaption>
    </figure>
  );
}
