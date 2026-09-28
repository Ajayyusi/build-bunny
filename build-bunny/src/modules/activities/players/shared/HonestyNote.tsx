"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/ui";

/**
 * "No fake AI" (plan §M; the handoff's "simulations are labelled as
 * simplified"): every AI activity says what the machine on screen really
 * is. AI_SIM levels author their own note; the classification, grouping
 * and ethics players use these fixed, accurate ones:
 *   tiny  — a real learning program, just a very small one, running in the
 *           page (1-nearest-neighbour sorting; nearest-flag grouping);
 *   story — made-up situations: no real AI and no real people involved.
 * A small label that opens to one sentence, so the play screen stays calm.
 */
export function HonestyNote({ kind }: { kind: "tinyClassifier" | "tinyGrouping" | "story" }) {
  const t = useTranslations("student.play.honesty");
  const badge = kind === "story" ? t("storyBadge") : t("tinyBadge");
  return (
    <details className="group w-fit max-w-full text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <Badge variant={kind === "story" ? "accent" : "positive"}>{badge}</Badge>
        <span className="font-semibold text-ink-muted underline-offset-4 group-open:hidden hover:underline">
          {t("what")}
        </span>
      </summary>
      <p className="mt-2 max-w-prose rounded-lg bg-surface-sunken p-3 leading-relaxed text-ink-muted">{t(kind)}</p>
    </details>
  );
}
