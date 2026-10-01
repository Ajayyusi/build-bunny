"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ConfusionCounts } from "@/modules/ai/knn";
import { cn } from "@/ui";

/**
 * Grades 5 to 7 (handoff: "Show confusion or error counts in a small
 * visual; ask students to defend their model choice").
 *
 * MistakeGrid is the test as a 2×2 table: what the bunny said against what
 * was true, right answers on the diagonal. It is a real table, so a screen
 * reader reads each count with its row and column.
 *
 * DefendModel asks, after a pass, why anyone should trust the model. Every
 * answer gets a reply; the strongest reason (it was right on cases it never
 * learned from) is the one the reply agrees with. Nothing is graded.
 */

export function MistakeGrid({
  counts,
  labels,
}: {
  counts: ConfusionCounts;
  labels: { positive: string; negative: string };
}) {
  const t = useTranslations("student.play.aiMode.grid");
  const cell = (n: number, right: boolean) => (
    <td
      className={cn(
        "rounded-md px-3 py-2 text-center font-display text-lg font-bold tabular-nums",
        right ? "bg-brand/15 text-brand-strong" : n > 0 ? "bg-danger/15 text-danger" : "bg-surface-sunken text-ink-muted",
      )}
    >
      {n}
      {right || n > 0 ? (
        <span aria-hidden="true" className="ms-1.5 text-xs">
          {right ? "✓" : "✗"}
        </span>
      ) : null}
      <span className="sr-only"> {right ? t("right") : t("wrong")}</span>
    </td>
  );
  return (
    <table data-testid="mistake-grid" className="w-fit border-separate border-spacing-1 text-sm">
      <caption className="pb-1 text-start text-xs font-semibold text-ink-muted">{t("caption")}</caption>
      <thead>
        <tr>
          <td />
          <th scope="col" className="px-2 text-xs font-semibold text-ink-muted">
            {t("said", { label: labels.positive })}
          </th>
          <th scope="col" className="px-2 text-xs font-semibold text-ink-muted">
            {t("said", { label: labels.negative })}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" className="pe-2 text-start text-xs font-semibold text-ink-muted">
            {t("really", { label: labels.positive })}
          </th>
          {cell(counts.rightYes, true)}
          {cell(counts.missedYes, false)}
        </tr>
        <tr>
          <th scope="row" className="pe-2 text-start text-xs font-semibold text-ink-muted">
            {t("really", { label: labels.negative })}
          </th>
          {cell(counts.falseYes, false)}
          {cell(counts.rightNo, true)}
        </tr>
      </tbody>
    </table>
  );
}

export const DEFENCES = ["unseen", "taught", "many"] as const;
export type Defence = (typeof DEFENCES)[number];

export function DefendModel() {
  const t = useTranslations("student.play.aiMode.defend");
  const [choice, setChoice] = useState<Defence | null>(null);
  return (
    <fieldset data-testid="defend-model" className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-3 text-start">
      <legend className="px-1 font-display text-sm font-bold text-ink">{t("question")}</legend>
      <div className="flex flex-col gap-1.5">
        {DEFENCES.map((id) => (
          <label
            key={id}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              choice === id ? "border-brand bg-brand/10" : "border-border hover:bg-surface-sunken",
            )}
          >
            <input
              type="radio"
              name="defend-model"
              value={id}
              checked={choice === id}
              onChange={() => setChoice(id)}
              className="size-4 accent-[var(--color-brand)]"
            />
            {t(`options.${id}`)}
          </label>
        ))}
      </div>
      {choice ? (
        <p role="status" className={cn("text-sm", choice === "unseen" ? "font-semibold text-brand-strong" : "text-ink")}>
          {t(`replies.${choice}`)}
        </p>
      ) : null}
    </fieldset>
  );
}
