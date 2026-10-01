"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { EXPLAIN_SLOTS, partId, phrasesFor, type ExplainSlot } from "@/modules/explore/explanations";
import { saveExplanation } from "@/modules/explore/server/actions";
import { cn, runAction } from "@/ui";

import { useLevelContext } from "./level-context";

/**
 * "Say it your way" on the success card of an Explore AI level: the child
 * builds "… because …, so …" from three rows of phrases. Only the phrase
 * ids are saved (never anything typed); their teacher sees the sentence.
 * Shown once the save has landed, for levels with a quick check.
 */
export function ExplainRow({ ready }: { ready: boolean }) {
  const level = useLevelContext();
  const concept = level?.explore?.explain ?? null;
  const t = useTranslations("student.play.explain");
  const locale = useLocale();
  const headingId = useId();
  const [picked, setPicked] = useState<Partial<Record<ExplainSlot, string>>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!level || !concept || !ready) return null;
  const phrase = (id: string) => t(`${concept}.${id}`);
  const complete = EXPLAIN_SLOTS.every((slot) => picked[slot]);
  const sentence = complete
    ? t("sentence", { what: phrase(picked.what!), why: phrase(picked.why!), next: phrase(picked.next!) })
    : null;
  // English sentences start with a capital; the phrases are written mid-sentence.
  const shown = sentence && locale === "en" ? sentence.charAt(0).toUpperCase() + sentence.slice(1) : sentence;

  const save = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const parts = EXPLAIN_SLOTS.map((slot) => partId(concept, picked[slot]!));
      const result = await runAction(() => saveExplanation({ levelId: level.levelId, parts }));
      if (result.ok) setSaved(true);
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-lg border-2 border-accent/40 bg-accent/10 p-3">
      <p id={headingId} className="text-xs font-bold uppercase tracking-wide text-ink-muted">
        <span aria-hidden="true">🗣️ </span>
        {t("title")}
      </p>
      {saved && shown ? (
        <>
          <p className="text-sm font-semibold text-ink">“{shown}”</p>
          <p role="status" className="text-sm text-ink-muted">{t("saved")}</p>
          <button
            type="button"
            onClick={() => setSaved(false)}
            className="w-fit text-sm font-semibold text-brand underline-offset-4 hover:underline"
          >
            {t("change")}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-muted">{t("help")}</p>
          {EXPLAIN_SLOTS.map((slot) => (
            <div key={slot} role="radiogroup" aria-label={t(`slot.${slot}`)} className="flex flex-col gap-1">
              <span className="text-xs font-bold text-ink-muted">{t(`slot.${slot}`)}</span>
              <div className="flex flex-wrap gap-1.5">
                {phrasesFor(slot).map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={picked[slot] === id}
                    onClick={() => setPicked((current) => ({ ...current, [slot]: id }))}
                    className={cn(
                      "min-h-9 rounded-full border-2 px-3 py-1 text-start text-sm transition-colors",
                      picked[slot] === id ? "border-brand bg-brand/10 font-semibold text-ink" : "border-border-token bg-surface-raised text-ink hover:bg-surface-sunken",
                    )}
                  >
                    {phrase(id)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {shown ? <p className="text-sm font-semibold text-ink">“{shown}”</p> : null}
          <button
            type="button"
            disabled={!complete || busy}
            onClick={() => void save()}
            className="min-h-11 w-fit rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            {t("save")}
          </button>
          {failed ? <p role="status" className="text-sm text-ink-muted">{t("notSaved")}</p> : null}
        </>
      )}
    </section>
  );
}
