"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ReadAloudButton } from "@/modules/audio/AudioControls";
import { useNarrateOnShow } from "@/modules/audio/scene";
import { CodeView } from "@/modules/blockly/CodeView";
import SimulationCanvas from "@/modules/simulation/SimulationCanvas";
import { BunnyMascot, Button, Dialog, cn, useReducedMotion } from "@/ui";

import { generateDisplayCode, runForPlayback } from "../client-run";
import { exampleForTags } from "./concept-examples";
import type { HintTierState } from "./HintDrawer";
import type { ActivityFeedback } from "../../types";

/**
 * "Ask Robo Bunny": four ways to get unstuck that are NOT the answer.
 *
 *  - Explain this block — what the selected block does, in one line.
 *  - Why did that fail? — the last run's failure explained in terms of the
 *    child's own program: which step stopped, which block was running, and
 *    what that kind of failure usually means. Deterministic: it reads the
 *    engine's located feedback and the run's block highlights; no model.
 *  - Give me a smaller hint — tier 1 of the authored hint ladder (the
 *    gentlest), with a path to the bigger tiers in the hint drawer.
 *  - Show a similar example — a tiny puzzle on the same idea, played by the
 *    real engine, never this level's solution.
 *
 * Everything is on screen as text; narration reads it when voice is on.
 */

export interface RoboHelpFailure {
  feedback: ActivityFeedback;
  /** 1-based step the run stopped at, when the failure is located. */
  step: number | null;
  /** The block that was running at that step, in program order. */
  block: { index: number; type: string } | null;
}

interface RoboHelpProps {
  open: boolean;
  onClose: () => void;
  worldTheme: string;
  tags: readonly string[];
  selectedBlockType: string | null;
  lastFailure: RoboHelpFailure | null;
  hints: HintTierState[];
  revealingTier: number | null;
  onRevealTier1: () => void;
  onOpenHints: () => void;
  /** Open straight on a topic (the failure banner's "Why did that fail?"). */
  initialTopic?: HelpTopic | null;
}

export type HelpTopic = "block" | "why" | "hint" | "example";
type Topic = HelpTopic;

export function RoboHelp({
  open,
  onClose,
  worldTheme,
  tags,
  selectedBlockType,
  lastFailure,
  hints,
  revealingTier,
  onRevealTier1,
  onOpenHints,
  initialTopic = null,
}: RoboHelpProps) {
  const t = useTranslations("student.play.help");
  const tBlocks = useTranslations("student.play.blockNames");
  const locale = useLocale();
  const reducedMotion = useReducedMotion();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [playing, setPlaying] = useState(false);

  const example = exampleForTags(tags);
  const tier1 = hints.find((hint) => hint.tier === 1) ?? null;

  // Each opening starts on the requested topic (or the menu), never on
  // whatever was left showing last time.
  useEffect(() => {
    if (!open) return;
    setTopic(initialTopic);
    setPlaying(false);
    if (initialTopic === "hint" && tier1 && !tier1.revealed) onRevealTier1();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on open only
  }, [open, initialTopic]);

  const blockName = (type: string) => (tBlocks.has(type) ? tBlocks(type) : type);

  // What Robo Bunny says for the chosen topic — one string, so narration and
  // the read-aloud button always match the card.
  let answer: string | null = null;
  if (topic === "block") {
    answer =
      selectedBlockType && t.has(`blocks.${selectedBlockType}`)
        ? t(`blocks.${selectedBlockType}`)
        : t("explainBlockNone");
  } else if (topic === "why") {
    if (!lastFailure) {
      answer = t("whyFailedNone");
    } else {
      const code = lastFailure.feedback.code;
      const reason = t.has(`why.${code}`) ? t(`why.${code}`) : t("why.generic");
      const where =
        lastFailure.step !== null && lastFailure.block
          ? t("failStep", {
              step: lastFailure.step,
              number: lastFailure.block.index,
              block: blockName(lastFailure.block.type),
            })
          : t("failNoStep");
      answer = `${where} ${reason}`;
    }
  } else if (topic === "hint") {
    answer = tier1?.revealed && tier1.text ? tier1.text : null;
  } else if (topic === "example") {
    answer = example ? t("similarIntro") : t("similarNone");
  }
  useNarrateOnShow(open ? answer : null);

  if (!open) return null;

  const exampleRun =
    example && playing
      ? runForPlayback(
          example.solution,
          { variants: [example.variant], autoCollect: example.autoCollect },
          locale === "ar" ? "ar" : "en",
        )
      : null;

  return (
    <Dialog open onClose={onClose} title={t("title")} closeLabel={t("close")} size="md">
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <BunnyMascot state={topic ? "pointing" : "thinking"} size="sm" className="shrink-0" />
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ["block", t("explainBlock")],
                ["why", t("whyFailed")],
                ["hint", t("smallerHint")],
                ["example", t("similar")],
              ] as [Topic, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={topic === key}
                onClick={() => {
                  setTopic(key);
                  setPlaying(false);
                  if (key === "hint" && tier1 && !tier1.revealed) onRevealTier1();
                }}
                className={cn(
                  "min-h-12 rounded-xl border-2 px-3 text-start text-sm font-bold transition-colors",
                  topic === key
                    ? "border-brand bg-brand/10 text-ink"
                    : "border-border-token bg-surface-raised text-ink hover:bg-surface-sunken",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {topic ? (
          <div className="flex flex-col gap-3 rounded-2xl rounded-ss-sm border border-border-token bg-surface-sunken p-4">
            {topic === "hint" && !answer ? (
              <p className="text-sm text-ink-muted">
                {revealingTier === 1 ? "…" : t("whyFailedNone")}
              </p>
            ) : null}
            {answer ? (
              <div className="flex items-start gap-2">
                <p className="flex-1 text-base leading-relaxed text-ink">{answer}</p>
                <ReadAloudButton text={answer} />
              </div>
            ) : null}

            {topic === "hint" ? (
              <Button variant="secondary" size="lg" onClick={onOpenHints} className="self-start">
                {t("biggerHint")}
              </Button>
            ) : null}

            {topic === "example" && example ? (
              <div className="flex flex-col gap-2">
                <div className="h-44 rounded-lg bg-surface-raised p-2">
                  <SimulationCanvas
                    variant={example.variant}
                    theme={worldTheme}
                    run={exampleRun}
                    playing={playing && exampleRun !== null}
                    onPlaybackEnd={() => setPlaying(false)}
                    reducedMotion={reducedMotion}
                    ariaLabel={example.caption[locale === "ar" ? "ar" : "en"]}
                  />
                </div>
                <CodeView code={generateDisplayCode(example.solution, locale === "ar" ? "ar" : "en")} />
                <p className="text-sm text-ink-muted">
                  {example.caption[locale === "ar" ? "ar" : "en"]}
                </p>
                <Button
                  size="lg"
                  onClick={() => setPlaying(true)}
                  disabled={playing}
                  className="self-start"
                >
                  {playing ? t("watching") : t("watch")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button variant="ghost" size="lg" onClick={onClose} className="self-end">
          {t("backToMine")}
        </Button>
      </div>
    </Dialog>
  );
}
