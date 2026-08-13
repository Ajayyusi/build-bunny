"use client";

import { useTranslations } from "next-intl";

import { glyphFill, glyphPx, glyphShapeStyle, glyphTheme, MYSTERY_FILL } from "@/modules/ai/glyph";
import { nearest, type LabelledSpecimen } from "@/modules/ai/knn";

/**
 * The receipt for the training run the student just finished.
 *
 * "You passed" tells a child nothing about why, and the live guess row
 * disappears behind the celebration overlay at exactly the moment it becomes
 * most worth reading. So the run is replayed here as a short, concrete
 * account: these are the examples YOU chose, and here is how each answer
 * followed from them — one line per mystery specimen, naming the taught
 * example it copied.
 *
 * Recomputed with the same shared classifier the grader used, so nothing
 * here can disagree with the verdict the child was just given.
 */

interface Specimen {
  id: string;
  size: number;
  color: number;
}

function Glyph({
  specimen,
  theme,
  mystery,
  scale = 1,
}: {
  specimen: Specimen;
  theme: string;
  mystery?: boolean;
  scale?: number;
}) {
  const glyph = glyphTheme(theme);
  const px = Math.round(glyphPx(glyph, specimen.size) * scale);
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 border-2 border-ink/15 align-middle"
      style={{
        width: px,
        height: px,
        background: mystery ? MYSTERY_FILL : glyphFill(glyph, specimen.color),
        ...glyphShapeStyle(glyph),
      }}
    />
  );
}

export function TeachRecap({
  examples,
  testSet,
  labels,
  glyph,
}: {
  examples: LabelledSpecimen[];
  testSet: Specimen[];
  labels: { positive: string; negative: string };
  glyph: string;
}) {
  const t = useTranslations("student.play.teach");

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
      <h2 className="font-display text-sm font-bold text-ink">
        {t("recapHeading")}
      </h2>

      {/* What they taught it with. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink-muted">
          {t("recapTaught", { count: examples.length })}
        </p>
        <ul className="flex flex-wrap items-center gap-2">
          {examples.map((example) => (
            <li
              key={example.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-token bg-surface-raised py-1 pe-2.5 ps-1.5"
            >
              <Glyph specimen={example} theme={glyph} scale={0.6} />
              <span
                className={
                  example.label === "positive"
                    ? "text-[11px] font-bold text-brand"
                    : "text-[11px] font-bold text-danger"
                }
              >
                {labels[example.label]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* How each answer followed. One line per mystery specimen, in the same
          visual grammar as the board and the walkthrough animation, so the
          child is reading a sentence they already know how to read. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink-muted">{t("recapDecided")}</p>
        <ul className="flex flex-col gap-2">
          {testSet.map((probe) => {
            const match = nearest(examples, probe);
            if (!match) return null;
            return (
              <li key={probe.id} className="flex flex-wrap items-center gap-2 text-xs">
                <Glyph specimen={probe} theme={glyph} mystery scale={0.6} />
                <span className="text-ink-muted">{t("looksLike")}</span>
                <Glyph specimen={match} theme={glyph} scale={0.6} />
                <span aria-hidden="true" className="text-ink-muted">
                  →
                </span>
                <span
                  className={
                    match.label === "positive"
                      ? "font-bold text-brand"
                      : "font-bold text-danger"
                  }
                >
                  {labels[match.label]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
