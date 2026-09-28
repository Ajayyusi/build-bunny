"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { ClassLabel } from "@/modules/ai/knn";
import { Button, cn } from "@/ui";

interface Probe {
  id: string;
  size: number;
  color: number;
}

interface Props {
  probes: Probe[];
  labels: { positive: string; negative: string };
  /** "berries", "shapes"… for select messages. */
  kind: string;
  predictions: Record<string, ClassLabel>;
  onPredict: (probeId: string, label: ClassLabel) => void;
  onReveal: () => void;
  renderGlyph: (probe: Probe) => ReactNode;
  describe: (probe: Probe) => string;
  /** The button "Show me the next step" last named, ringed. */
  pointed: string | null;
}

/**
 * The PREDICT step of the learning loop (redesign brief): before the
 * bunny's guesses appear, the child says what they think it will answer for
 * every mystery specimen. Only then can they see its guesses — and whether
 * the bunny surprised them. A child's own guess is never graded; it is the
 * thinking the reveal answers.
 */
export function TeachPredict({
  probes,
  labels,
  kind,
  predictions,
  onPredict,
  onReveal,
  renderGlyph,
  describe,
  pointed,
}: Props) {
  const t = useTranslations("student.play.teach");
  const done = probes.every((probe) => predictions[probe.id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-ink">{t("predictHeading")}</p>
        <p className="text-xs text-ink-muted">{t("predictHelp", { kind })}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {probes.map((probe, index) => (
          <li key={probe.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-token bg-surface p-3">
            <span className="relative shrink-0">
              {renderGlyph(probe)}
              <span
                aria-hidden="true"
                className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-surface-raised"
              >
                ?
              </span>
            </span>
            <span id={`predict-${probe.id}`} className="sr-only">
              {t("predictItem", { number: index + 1, description: describe(probe) })}
            </span>
            <div role="radiogroup" aria-labelledby={`predict-${probe.id}`} className="flex flex-wrap gap-2">
              {(["positive", "negative"] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={predictions[probe.id] === label}
                  onClick={() => onPredict(probe.id, label)}
                  className={cn(
                    "min-h-11 rounded-lg border-2 px-3 text-sm font-semibold transition-colors",
                    predictions[probe.id] === label
                      ? label === "positive"
                        ? "border-brand bg-brand/10 text-ink"
                        : "border-danger bg-danger/10 text-ink"
                      : "border-border-token bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink",
                  )}
                >
                  {labels[label]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Button
        onClick={onReveal}
        disabled={!done}
        className={cn("w-fit", pointed === "revealGuesses" && "ring-4 ring-accent ring-offset-2 ring-offset-surface")}
      >
        {t("predictReveal")}
      </Button>
    </div>
  );
}
