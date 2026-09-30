"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { ClassLabel } from "@/modules/ai/knn";
import type { CaseStatus } from "@/modules/ai/report";
import { cn } from "@/ui";
import { CharacterLine } from "@/modules/characters/Character";

/**
 * The AI project report (capstone): pick one held-back case the model got
 * wrong or wasn't sure about, then a safeguard that keeps a person in
 * charge of it. What counts as a failure is decided by caseStatuses() in
 * @/modules/ai/report — the same function the grader checks with.
 */

export interface ReportCase {
  id: string;
  guess: ClassLabel | null;
  truth: ClassLabel;
  status: CaseStatus;
}

export interface ReportValue {
  caseId: string | null;
  safeguardId: string | null;
}

const STATUS_STYLE: Record<CaseStatus, string> = {
  wrong: "bg-danger/15 text-danger",
  closeCall: "bg-warning/14 text-warning-strong",
  leastSure: "bg-warning/14 text-warning-strong",
  right: "bg-brand/15 text-brand-strong",
};

export function ProjectReport({
  cases,
  labels,
  safeguards,
  value,
  onChange,
  renderGlyph,
  describe,
  pointed,
  disabled,
}: {
  cases: ReportCase[];
  labels: Record<ClassLabel, string>;
  safeguards: { id: string; text: string }[];
  value: ReportValue;
  onChange: (next: ReportValue) => void;
  renderGlyph: (id: string) => ReactNode;
  describe: (id: string) => string;
  /** The hint's pointer: a case id or a safeguard id to ring. */
  pointed: string | null;
  disabled?: boolean;
}) {
  const t = useTranslations("student.play.teach.report");
  const picked = cases.find((c) => c.id === value.caseId);
  const safeguard = safeguards.find((s) => s.id === value.safeguardId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 id="report-case" className="text-sm font-bold text-ink">
          {t("caseQuestion")}
        </h3>
        {cases.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("noCases")}</p>
        ) : (
          <div role="radiogroup" aria-labelledby="report-case" className="flex flex-col gap-1.5">
            {cases.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={value.caseId === c.id}
                disabled={disabled}
                onClick={() => onChange({ ...value, caseId: c.id })}
                className={cn(
                  "flex min-h-11 flex-wrap items-center gap-2 rounded-xl border-2 p-2 text-start text-sm transition-colors",
                  value.caseId === c.id ? "border-brand bg-brand/10" : "border-border-token bg-surface hover:bg-surface-sunken",
                  pointed === c.id && "ring-4 ring-accent ring-offset-2 ring-offset-surface",
                )}
              >
                <span aria-hidden="true" className="shrink-0">
                  {renderGlyph(c.id)}
                </span>
                <span className="flex-1 text-ink">
                  {t("caseLine", {
                    specimen: describe(c.id),
                    guess: c.guess ? labels[c.guess] : "—",
                    truth: labels[c.truth],
                  })}
                </span>
                <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold", STATUS_STYLE[c.status])}>
                  {t(`status.${c.status}`)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <CharacterLine id="noura" line="whoDecides" />
        <h3 id="report-safeguard" className="text-sm font-bold text-ink">
          {t("safeguardQuestion")}
        </h3>
        <div role="radiogroup" aria-labelledby="report-safeguard" className="flex flex-col gap-1.5">
          {safeguards.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={value.safeguardId === s.id}
              disabled={disabled}
              onClick={() => onChange({ ...value, safeguardId: s.id })}
              className={cn(
                "min-h-11 rounded-xl border-2 p-2 text-start text-sm text-ink transition-colors",
                value.safeguardId === s.id ? "border-brand bg-brand/10 font-semibold" : "border-border-token bg-surface hover:bg-surface-sunken",
                pointed === s.id && "ring-4 ring-accent ring-offset-2 ring-offset-surface",
              )}
            >
              {s.text}
            </button>
          ))}
        </div>
      </div>

      {picked && safeguard ? (
        <p className="rounded-xl border border-border-token bg-surface-raised p-3 text-sm text-ink">
          <span className="font-bold">{t("summaryTitle")} </span>
          {t("summary", { specimen: describe(picked.id), safeguard: safeguard.text })}
        </p>
      ) : null}
    </div>
  );
}
