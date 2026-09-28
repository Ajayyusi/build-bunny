"use client";

import { useTranslations } from "next-intl";

import { termsForTags } from "@/modules/explore/glossary";

/**
 * "What is this called?" — closed until a child asks, then the proper names
 * for what this activity does, each with one plain sentence. The first
 * screen stays free of technical labels (handoff); the words are one tap
 * away for the children who want them.
 */
export function WhatIsThisCalled({ tags }: { tags: readonly string[] }) {
  const t = useTranslations("student.glossary");
  const terms = termsForTags(tags);
  if (terms.length === 0) return null;
  return (
    <details className="group w-fit max-w-full text-xs">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-border-token bg-surface-raised px-2.5 py-1 font-semibold text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">📖</span>
        {t("ask")}
      </summary>
      <dl className="mt-2 flex max-w-prose flex-col gap-2 rounded-lg bg-surface-sunken p-3">
        {terms.map((term) => (
          <div key={term}>
            <dt className="font-bold text-ink">{t(`${term}.name`)}</dt>
            <dd className="leading-relaxed text-ink-muted">{t(`${term}.plain`)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
