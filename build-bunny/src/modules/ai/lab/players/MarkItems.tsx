"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/ui";

import type { StudentMarkItemsConfig } from "../mark-items/types";
import { resolveLocalized } from "./format";
import type { AiSimWidgetPlayerProps } from "./registry";
import { useStableCallback } from "./useStableCallback";

/**
 * "Mark the items": one widget, three lessons from the handoff's backlog.
 *  - sentences — two chatbot answers, each sentence marked "matches the
 *    notice" or "made up", against the notice on screen (generative AI);
 *  - tokens    — a message to an AI helper; tap each detail the helper
 *    doesn't need to strike it out (AI and privacy);
 *  - choices   — an instruction to an assistant with vague parts; pick the
 *    clear wording for each, and see what the assistant now hears
 *    (natural language).
 * An optional question comes first (PREDICT). Nothing here knows the
 * answers: the server grades the marks (mark-items/grade.ts).
 */

/** Keeps only marks for items and marks this level still has. */
function restoreMarks(work: unknown, config: StudentMarkItemsConfig): Record<string, string> {
  if (work === null || typeof work !== "object") return {};
  const marks = (work as { marks?: unknown }).marks;
  if (marks === null || typeof marks !== "object") return {};
  const out: Record<string, string> = {};
  for (const group of config.groups) {
    for (const item of group.items) {
      const mark = (marks as Record<string, unknown>)[item.id];
      if (!item.markable || typeof mark !== "string") continue;
      const valid = item.options ? item.options.some((o) => o.id === mark) : (config.marks ?? []).some((m) => m.id === mark);
      if (valid) out[item.id] = mark;
    }
  }
  return out;
}

export function MarkItems({ config: rawConfig, locale, disabled, onWorkChange, initialWork }: AiSimWidgetPlayerProps) {
  const config = rawConfig as StudentMarkItemsConfig;
  const t = useTranslations("student.play.aiSim.markItems");
  const reportWork = useStableCallback(onWorkChange);
  const text = (value: Parameters<typeof resolveLocalized>[0]) => resolveLocalized(value, locale);

  const [marks, setMarks] = useState<Record<string, string>>(() => restoreMarks(initialWork, config));
  const [predicted, setPredicted] = useState<string | null>(null);
  const predicting = Boolean(config.predict) && predicted === null;

  const markable = useMemo(() => config.groups.flatMap((g) => g.items.filter((i) => i.markable)), [config.groups]);
  const markOf = (id: string) => marks[id] ?? config.defaultMark ?? null;
  const ready = !predicting && markable.every((item) => markOf(item.id) !== null);

  useEffect(() => {
    reportWork({ marks }, ready, { predicting });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, ready, predicting]);

  const set = (itemId: string, markId: string) => {
    if (disabled) return;
    setMarks((current) => ({ ...current, [itemId]: markId }));
  };
  const toggleToken = (itemId: string) => {
    const [keep, strike] = config.marks ?? [];
    if (!keep || !strike) return;
    set(itemId, markOf(itemId) === strike.id ? keep.id : strike.id);
  };

  if (config.predict && predicting) {
    return (
      <div role="group" aria-labelledby="mark-items-predict" className="flex flex-col gap-3 rounded-xl border-2 border-info/40 bg-info/10 p-4">
        <p id="mark-items-predict" className="text-sm font-bold text-ink">
          {text(config.predict.question)}
        </p>
        <div className="flex flex-wrap gap-2">
          {config.predict.options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => setPredicted(option.id)}
              className="min-h-11 rounded-lg border-2 border-info/40 bg-surface-raised px-4 py-2 text-sm font-semibold text-ink hover:bg-info/20"
            >
              {text(option.text)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const predictedOption = config.predict?.options.find((o) => o.id === predicted);

  return (
    <div className="flex flex-col gap-4">
      {predictedOption ? (
        <p className="w-fit rounded-full bg-info/10 px-3 py-1 text-xs font-bold text-ink">
          {t("youSaid", { answer: text(predictedOption.text) })}
        </p>
      ) : null}

      {config.source ? (
        <section aria-label={text(config.source.title)} className="flex flex-col gap-1 rounded-xl border-2 border-border-token bg-surface-sunken p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{text(config.source.title)}</h3>
          {config.source.lines.map((line, i) => (
            <p key={i} className="text-sm text-ink">
              {text(line)}
            </p>
          ))}
        </section>
      ) : null}

      {config.layout === "sentences"
        ? config.groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-2 rounded-xl border-2 border-border-token bg-surface-raised p-4">
              {group.title ? <h3 className="font-display text-sm font-bold text-ink">🤖 {text(group.title)}</h3> : null}
              <ul className="flex flex-col gap-2">
                {group.items.map((item) =>
                  item.markable ? (
                    <li key={item.id} className="flex flex-col gap-1.5 rounded-lg bg-surface-sunken p-2 sm:flex-row sm:items-center">
                      <span className="flex-1 text-sm text-ink">{text(item.text)}</span>
                      <span role="radiogroup" aria-label={text(item.text)} className="flex shrink-0 gap-1.5">
                        {(config.marks ?? []).map((mark) => (
                          <button
                            key={mark.id}
                            type="button"
                            role="radio"
                            aria-checked={markOf(item.id) === mark.id}
                            disabled={disabled}
                            onClick={() => set(item.id, mark.id)}
                            className={cn(
                              "min-h-9 rounded-full border-2 px-2.5 text-xs font-bold transition-colors",
                              markOf(item.id) === mark.id ? "border-brand bg-brand/10 text-ink" : "border-border-token bg-surface-raised text-ink-muted hover:text-ink",
                            )}
                          >
                            {mark.icon ? <span aria-hidden="true">{mark.icon} </span> : null}
                            {text(mark.text)}
                          </button>
                        ))}
                      </span>
                    </li>
                  ) : (
                    <li key={item.id} className="text-sm text-ink-muted">
                      {text(item.text)}
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))
        : null}

      {config.layout === "tokens"
        ? config.groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-2 rounded-xl border-2 border-border-token bg-surface-raised p-4">
              {group.title ? <h3 className="font-display text-sm font-bold text-ink">✉️ {text(group.title)}</h3> : null}
              <p className="text-xs text-ink-muted">{t("tokensHelp")}</p>
              <p className="text-base leading-loose text-ink">
                {group.items.map((item) => {
                  // Spacing is in the content (a plain piece carries its own spaces).
                  if (!item.markable) return <span key={item.id}>{text(item.text)}</span>;
                  const struck = markOf(item.id) === config.marks?.[1]?.id;
                  return (
                    <span key={item.id}>
                      <button
                        type="button"
                        aria-pressed={struck}
                        aria-label={struck ? t("struck", { text: text(item.text) }) : t("kept", { text: text(item.text) })}
                        disabled={disabled}
                        onClick={() => toggleToken(item.id)}
                        className={cn(
                          "rounded-md border-2 border-dashed px-1.5 py-0.5 font-semibold transition-colors",
                          struck ? "border-danger/50 bg-danger/10 text-ink-muted line-through decoration-2" : "border-brand/40 bg-brand/5 text-ink hover:bg-brand/10",
                        )}
                      >
                        {text(item.text)}
                      </button>
                    </span>
                  );
                })}
              </p>
            </section>
          ))
        : null}

      {config.layout === "choices"
        ? config.groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-3 rounded-xl border-2 border-border-token bg-surface-raised p-4">
              {group.title ? <h3 className="font-display text-sm font-bold text-ink">🗣️ {text(group.title)}</h3> : null}
              <p className="text-base leading-relaxed text-ink">
                {group.items.map((item) =>
                  item.markable ? (
                    <mark key={item.id} className="rounded bg-accent/30 px-1 text-ink">
                      {text(item.text)}
                    </mark>
                  ) : (
                    <span key={item.id}>{text(item.text)}</span>
                  ),
                )}
              </p>
              <ul className="flex flex-col gap-2">
                {group.items
                  .filter((item) => item.markable && item.options)
                  .map((item) => (
                    <li key={item.id} className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-ink-muted">{t("vague", { text: text(item.text) })}</span>
                      <span role="radiogroup" aria-label={t("vague", { text: text(item.text) })} className="flex flex-wrap gap-1.5">
                        {item.options!.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={markOf(item.id) === option.id}
                            disabled={disabled}
                            onClick={() => set(item.id, option.id)}
                            className={cn(
                              "min-h-9 rounded-full border-2 px-3 text-sm transition-colors",
                              markOf(item.id) === option.id ? "border-brand bg-brand/10 font-semibold text-ink" : "border-border-token bg-surface-raised text-ink hover:bg-surface-sunken",
                            )}
                          >
                            {text(option.text)}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
              </ul>
              {/* What the assistant hears now, with the child's wording in. */}
              <p className="rounded-lg bg-surface-sunken p-3 text-sm text-ink">
                <span className="font-bold">{t("hears")} </span>
                {group.items
                  .map((item) => {
                    const chosen = item.options?.find((o) => o.id === markOf(item.id));
                    return chosen ? text(chosen.text) : text(item.text);
                  })
                  .join("")}
              </p>
            </section>
          ))
        : null}
    </div>
  );
}
