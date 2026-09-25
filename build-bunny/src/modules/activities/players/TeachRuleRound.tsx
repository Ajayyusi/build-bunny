"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ruleMisses, ruleSays } from "@/modules/ai/rule-round";
import { Button, cn } from "@/ui";

import type { TeachRuleRound as RuleRound } from "../types";

type Specimen = { id: string; size: number; color: number; truth: "positive" | "negative" };

interface Props {
  round: RuleRound;
  stage: "pick" | "today";
  labels: { positive: string; negative: string };
  truthEmoji: { positive: string; negative: string };
  /** Words for "berries"/"seeds"… in select messages. */
  kind: string;
  /** The specimen glyph, drawn by the parent so both rounds look the same. */
  renderGlyph: (specimen: Specimen) => ReactNode;
  describe: (specimen: Specimen) => string;
  chosen: string | null;
  tested: string | null;
  /** The rule card or button "Show me the next step" last named. */
  pointed: string | null;
  onChoose: (ruleId: string) => void;
  onTest: () => void;
  onSeeToday: () => void;
  onTeach: () => void;
  /** "Show me the next step", placed beside this round's own buttons. */
  hint: ReactNode;
}

/**
 * Rule or Examples?, parts 1 and 2 — the coding way, before the learning way.
 *
 * Part 1: pick a rule card and test it on yesterday's specimens until one
 * fits them all. Part 2: that rule meets today's specimens, and the new kind
 * shows it up. Nothing here is graded; the lesson is what the child SEES the
 * rule do. Part 3 is the ordinary teaching board.
 */
export function TeachRuleRound({
  round,
  stage,
  labels,
  truthEmoji,
  kind,
  renderGlyph,
  describe,
  chosen,
  tested,
  pointed,
  onChoose,
  onTest,
  onSeeToday,
  onTeach,
  hint,
}: Props) {
  const t = useTranslations("student.play.teach");
  const testedRule = round.rules.find((rule) => rule.id === tested) ?? null;
  const yesterdayMisses = testedRule ? ruleMisses(testedRule, round.yesterday) : [];
  const fits = testedRule !== null && yesterdayMisses.length === 0;
  const ring = (id: string) => (pointed === id ? "ring-4 ring-accent ring-offset-2 ring-offset-surface" : "");

  /** A coloured label chip; `text` is the full sentence ("Rule says: Not safe"). */
  const chip = (label: "positive" | "negative", text: string) => (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-center text-[11px] font-bold",
        label === "positive" ? "bg-brand/15 text-brand" : "bg-danger/15 text-danger",
      )}
    >
      <span aria-hidden="true">{truthEmoji[label]} </span>
      {text}
    </span>
  );

  const card = (specimen: Specimen, verdict: ReactNode, wrong: boolean | null) => (
    <li
      key={specimen.id}
      className={cn(
        "flex w-36 flex-col items-center gap-2 rounded-xl border-2 bg-surface-raised p-3",
        wrong === null ? "border-border-token" : wrong ? "border-danger/60" : "border-brand/50",
      )}
    >
      <span className="grid h-14 place-items-center">{renderGlyph(specimen)}</span>
      <span className="sr-only">{describe(specimen)}</span>
      {verdict}
      {wrong !== null ? (
        <span className={cn("text-xs font-bold", wrong ? "text-danger" : "text-brand")}>
          <span aria-hidden="true">{wrong ? "✗ " : "✓ "}</span>
          {wrong ? t("ruleWrong") : t("ruleRight")}
        </span>
      ) : null}
    </li>
  );

  if (stage === "today") {
    const rule = round.rules.find((r) => r.id === chosen) ?? round.rules[0]!;
    const misses = ruleMisses(rule, round.today);
    return (
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <div className="flex flex-col">
            <h2 className="font-display text-base font-bold text-ink">{t("ruleTodayHeading")}</h2>
            <p className="text-sm text-ink-muted">{t("ruleTodayHelp")}</p>
          </div>
          <p className="w-fit rounded-lg border-2 border-ink/15 bg-surface-sunken px-3 py-2 font-mono text-sm font-bold text-ink">
            {t("ruleYours", { rule: rule.label })}
          </p>
          <ul className="flex flex-wrap gap-3">
            {round.today.map((specimen) => {
              const says = ruleSays(rule, specimen);
              return card(
                specimen,
                <span className="flex flex-col items-center gap-1">
                  {chip(says, t("ruleSays", { label: labels[says] }))}
                  {chip(specimen.truth, t("ruleReally", { label: labels[specimen.truth] }))}
                </span>,
                says !== specimen.truth,
              );
            })}
          </ul>
          <p role="status" className="rounded-lg bg-accent/20 px-3 py-2 text-sm font-semibold text-ink">
            {misses.length > 0 ? t("ruleTodayMisses", { count: misses.length }) : t("ruleTodayAllRight")}
          </p>
        </section>
        <div className="flex flex-wrap items-center gap-3 pb-2">
          <Button size="lg" onClick={onTeach} className={ring("teachInstead")}>
            {t("ruleTeach")}
          </Button>
          {hint}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col">
          <h2 className="font-display text-base font-bold text-ink">{t("ruleYesterdayHeading", { kind })}</h2>
          <p className="text-sm text-ink-muted">{t("ruleYesterdayHelp")}</p>
        </div>
        <ul className="flex flex-wrap gap-3">
          {round.yesterday.map((specimen) =>
            card(
              specimen,
              <span className="flex flex-col items-center gap-1">
                {chip(specimen.truth, labels[specimen.truth])}
                {testedRule
                  ? chip(ruleSays(testedRule, specimen), t("ruleSays", { label: labels[ruleSays(testedRule, specimen)] }))
                  : null}
              </span>,
              testedRule ? yesterdayMisses.includes(specimen.id) : null,
            ),
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col">
          <h2 id="rule-pick-heading" className="font-display text-base font-bold text-ink">
            {t("rulePickHeading")}
          </h2>
          <p className="text-sm text-ink-muted">{t("rulePickHelp")}</p>
        </div>
        <div role="radiogroup" aria-labelledby="rule-pick-heading" className="flex flex-wrap gap-2">
          {round.rules.map((rule) => (
            <button
              key={rule.id}
              type="button"
              role="radio"
              aria-checked={chosen === rule.id}
              onClick={() => onChoose(rule.id)}
              className={cn(
                "min-h-11 rounded-lg border-2 px-4 py-2 font-mono text-sm font-bold transition-colors",
                chosen === rule.id
                  ? "border-brand bg-brand/10 text-ink"
                  : "border-border-token bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink",
                ring(rule.id),
              )}
            >
              {rule.label}
            </button>
          ))}
        </div>
        {testedRule ? (
          <p
            role="status"
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold",
              fits ? "bg-brand/15 text-brand" : "bg-accent/20 text-ink",
            )}
          >
            {fits ? t("ruleFits") : t("ruleMisses", { count: yesterdayMisses.length })}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3 pb-2">
        {fits && tested === chosen ? (
          <Button size="lg" onClick={onSeeToday} className={ring("seeToday")}>
            {t("ruleSeeToday", { kind })}
          </Button>
        ) : (
          <Button size="lg" onClick={onTest} disabled={!chosen} className={ring("testRule")}>
            {t("ruleTest")}
          </Button>
        )}
        {hint}
      </div>
    </div>
  );
}
