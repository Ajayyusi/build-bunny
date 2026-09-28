"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { nearest, type LabelledSpecimen } from "@/modules/ai/knn";
import { cn } from "@/ui";

interface Specimen {
  id: string;
  size: number;
  color: number;
}
interface KnownSpecimen extends Specimen {
  truth: "positive" | "negative";
}

interface Props {
  /** Example ids the child taught on their first failed test; null if they passed first time. */
  before: string[] | null;
  examples: LabelledSpecimen[];
  pool: KnownSpecimen[];
  labels: { positive: string; negative: string };
  kind: string;
  renderGlyph: (specimen: Specimen) => ReactNode;
}

/**
 * The result screen's "what changed" and "one new example to test"
 * (redesign brief): which examples the child added or took out between
 * their first failed test and the pass, and one more specimen the bunny
 * wasn't taught, with its guess and the truth — a new case, tested.
 */
export function TeachWhatChanged({ before, examples, pool, labels, kind, renderGlyph }: Props) {
  const t = useTranslations("student.play.teach");
  const now = new Set(examples.map((e) => e.id));
  const was = new Set(before ?? []);
  const added = before ? pool.filter((s) => now.has(s.id) && !was.has(s.id)) : [];
  const removed = before ? pool.filter((s) => was.has(s.id) && !now.has(s.id)) : [];
  const spare = pool.find((s) => !now.has(s.id)) ?? null;
  const guess = spare ? nearest(examples, spare)?.label ?? null : null;

  const row = (items: Specimen[]) => (
    <span className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <span key={item.id} className="scale-75">
          {renderGlyph(item)}
        </span>
      ))}
    </span>
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-token p-3 text-sm">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("whatChangedHeading")}</h3>
        {before === null ? (
          <p className="text-ink">{t("whatChangedFirstTry", { kind })}</p>
        ) : added.length === 0 && removed.length === 0 ? (
          <p className="text-ink">{t("whatChangedNone")}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {added.length > 0 ? (
              <p className="flex flex-wrap items-center gap-2 text-ink">
                <span>{t("whatChangedAdded")}</span>
                {row(added)}
              </p>
            ) : null}
            {removed.length > 0 ? (
              <p className="flex flex-wrap items-center gap-2 text-ink">
                <span>{t("whatChangedRemoved")}</span>
                {row(removed)}
              </p>
            ) : null}
          </div>
        )}
      </div>
      {spare && guess ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("newExampleHeading")}</h3>
          <p className="flex flex-wrap items-center gap-2 text-ink">
            {renderGlyph(spare)}
            <span>{t("newExampleSays", { label: labels[guess] })}</span>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-bold",
                guess === spare.truth ? "bg-brand/15 text-brand" : "bg-danger/15 text-danger",
              )}
            >
              {guess === spare.truth ? t("newExampleRight") : t("newExampleWrong", { label: labels[spare.truth] })}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
