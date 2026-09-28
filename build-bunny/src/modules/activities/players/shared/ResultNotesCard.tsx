"use client";

import { useTranslations } from "next-intl";

import type { ResultLine, ResultNotes } from "../result-notes";

/**
 * The AI result's three lines: what you tried, what changed, one more to
 * test. Rendered through SuccessOverlay's `extra`, above the big idea: the
 * child sees what they did before being told what it meant.
 */
export function ResultNotesCard({ notes }: { notes: ResultNotes }) {
  const t = useTranslations("student.play.resultNotes");
  const line = (value: ResultLine) => ("text" in value ? value.text : t(value.key, value.values));
  const rows = [
    { icon: "🧪", label: t("triedLabel"), text: line(notes.tried) },
    { icon: "🔁", label: t("changedLabel"), text: line(notes.changed) },
    { icon: "🔍", label: t("tryNextLabel"), text: line(notes.tryNext) },
  ];
  return (
    <ul className="flex flex-col gap-2 rounded-lg border border-border-token p-3">
      {rows.map((row) => (
        <li key={row.label} className="flex items-start gap-2">
          <span aria-hidden="true">{row.icon}</span>
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{row.label}</span>
            <span className="text-sm leading-relaxed text-ink">{row.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
