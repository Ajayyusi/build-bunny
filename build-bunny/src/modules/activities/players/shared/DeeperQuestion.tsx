"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/ui";

import { DEEPER, type DeeperId } from "../deeper-questions";

export type { DeeperId };

/**
 * Grades 5 to 7 ("More detail"): one deeper question after a pass, outside
 * the Teach levels (which have "defend your model"). Each is about the idea
 * the activity just showed, at the next level down: how sure a guess can
 * be, how many numbers a picture really is, what a score can and cannot
 * choose. Every answer gets a reply; nothing is graded or stored.
 */
export function DeeperQuestion({ id, values = {} }: { id: DeeperId; values?: Record<string, string | number> }) {
  const t = useTranslations("student.play.aiMode.deeper");
  const [choice, setChoice] = useState<string | null>(null);
  const { options, best } = DEEPER[id];
  return (
    <div data-testid="deeper-question" className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-3 text-start">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("heading")}</p>
      <p id={`deeper-${id}`} className="font-display text-sm font-bold text-ink">
        {t(`${id}.question`, values)}
      </p>
      <div role="radiogroup" aria-labelledby={`deeper-${id}`} className="flex flex-col gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={choice === option}
            onClick={() => setChoice(option)}
            className={cn(
              "min-h-11 rounded-lg border px-3 py-2 text-start text-sm",
              choice === option ? "border-brand bg-brand/10 font-semibold" : "border-border hover:bg-surface-sunken",
            )}
          >
            {t(`${id}.options.${option}`, values)}
          </button>
        ))}
      </div>
      {choice ? (
        <p role="status" className={cn("text-sm", choice === best ? "font-semibold text-brand-strong" : "text-ink")}>
          {t(`${id}.replies.${choice}`, values)}
        </p>
      ) : null}
    </div>
  );
}
