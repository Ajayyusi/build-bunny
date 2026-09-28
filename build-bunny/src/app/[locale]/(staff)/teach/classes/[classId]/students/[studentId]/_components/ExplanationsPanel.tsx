"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { AI_CONCEPTS, type AiConcept } from "@/modules/analytics/ai-concepts";
import { setConceptObserved } from "@/modules/explore/server/actions";
import { Card, CardBody, CardTitle, runAction, useToast } from "@/ui";

export interface ExplanationVM {
  levelId: string;
  levelTitle: string;
  concept: string;
  parts: string[];
  soundParts: number;
}

/**
 * How a child explains AI: their "Say it your way" sentences (built from
 * fixed phrases, never typed), how many parts hold up, and a tick per AI
 * concept for "I heard them explain it aloud" — the evidence a sentence
 * builder can't capture.
 */
export function ExplanationsPanel({
  studentUserId,
  explanations,
  observed,
}: {
  studentUserId: string;
  explanations: ExplanationVM[];
  observed: string[];
}) {
  const t = useTranslations("staff.teach.student.explain");
  const tPhrase = useTranslations("student.play.explain");
  const tConcept = useTranslations("staff.teach.matrix.aiConcepts.name");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set(observed));
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (concept: AiConcept) => {
    const next = !ticked.has(concept);
    setBusy(concept);
    try {
      const result = await runAction(() => setConceptObserved({ studentUserId, concept, observed: next }));
      if (result.ok) {
        setTicked((current) => {
          const copy = new Set(current);
          if (next) copy.add(concept);
          else copy.delete(concept);
          return copy;
        });
        router.refresh();
      } else {
        toast({ title: t("error"), variant: "danger" });
      }
    } finally {
      setBusy(null);
    }
  };

  const sentenceOf = (e: ExplanationVM) => {
    const [what, why, next] = e.parts.map((part) => tPhrase(part));
    const s = tPhrase("sentence", { what: what ?? "", why: why ?? "", next: next ?? "" });
    return locale === "en" ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  };

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <CardTitle>{t("heading")}</CardTitle>
        <p className="text-sm text-ink-muted">{t("help")}</p>
        {explanations.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {explanations.map((e) => (
              <li key={e.levelId} className="flex flex-col gap-0.5 rounded-lg bg-surface-sunken px-3 py-2">
                <span className="text-xs font-bold text-ink-muted">{e.levelTitle}</span>
                <span className="text-sm text-ink">“{sentenceOf(e)}”</span>
                <span className="text-xs text-ink-muted">{t("sound", { sound: e.soundParts })}</span>
              </li>
            ))}
          </ul>
        )}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-semibold text-ink">{t("heardHeading")}</legend>
          {AI_CONCEPTS.map((concept) => (
            <label key={concept} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-5 accent-brand"
                checked={ticked.has(concept)}
                disabled={busy !== null}
                onChange={() => void toggle(concept)}
              />
              {tConcept(concept)}
            </label>
          ))}
        </fieldset>
      </CardBody>
    </Card>
  );
}
