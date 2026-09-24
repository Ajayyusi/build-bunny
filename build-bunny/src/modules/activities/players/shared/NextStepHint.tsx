"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ReadAloudButton } from "@/modules/audio/AudioControls";
import { useNarrateOnShow } from "@/modules/audio/scene";
import type { BlockPlace, NextStep } from "@/modules/hints/types";
import { BunnyMascot, Button, Dialog, cn } from "@/ui";

import type { NextStepAction, NextStepStateInput } from "../../types";

/**
 * "Show me the next step" — the one helper in the player that is allowed to
 * be the answer, one move at a time. Everything else ("Ask Robo Bunny", the
 * hint ladder) explains; this names the next thing to DO: which block, and
 * exactly where; which berry to teach; where to plant a flag.
 *
 * The first use on a level asks once, because it caps the level at two
 * stars (it is recorded as hint tier 5, above the authored ladder).
 */

/** How a player names the things a hint points at. */
export interface NextStepNames {
  option?: (id: string) => string;
  item?: (id: string) => string;
  specimen?: (id: string) => string;
  label?: (label: "positive" | "negative") => string;
  choice?: (id: string) => string;
  round?: (id: string) => string;
  image?: (id: string) => string;
  /** Plain words for a spot on a feature board (plantFlag). */
  spot?: (size: number, color: number) => string;
}

export function useNextStepText() {
  const t = useTranslations("student.play.nextStep");
  const tBlocks = useTranslations("student.play.blockNames");
  const block = (type: string) => (tBlocks.has(type) ? tBlocks(type) : type);
  const place = (p: BlockPlace): string => {
    switch (p.kind) {
      case "start":
        return t("place.start");
      case "after":
        return t("place.after", { index: p.index, anchor: block(p.block) });
      case "inside":
        return t(p.mouth === "ELSE" ? "place.insideElse" : "place.inside", { index: p.index, anchor: block(p.block) });
      case "condition":
        return t("place.condition", { index: p.index, anchor: block(p.block) });
      case "newTrick":
        return t("place.newTrick");
      case "insideTrick":
        return t("place.insideTrick");
    }
  };
  return (step: NextStep, names: NextStepNames, readyAction: string): string => {
    const name = (fn: ((id: string) => string) | undefined, id: string) => (fn ? fn(id) : id);
    switch (step.code) {
      case "ready":
        return t(step.better ? "readyBetter" : "ready", { action: readyAction });
      case "addBlock":
        return step.value !== undefined && step.block !== "bb_defineTrick"
          ? t("addBlockValue", { block: block(step.block), place: place(step.place), value: step.value })
          : t("addBlock", { block: block(step.block), place: place(step.place) });
      case "removeBlock":
        return step.index > 0 ? t("removeBlock", { index: step.index, block: block(step.block) }) : t("removeSensor", { block: block(step.block) });
      case "changeBlock":
        return step.value !== undefined
          ? t("changeBlockValue", { index: step.index, from: block(step.from), to: block(step.to), value: step.value })
          : t("changeBlock", { index: step.index, from: block(step.from), to: block(step.to) });
      case "setNumber":
        return t("setNumber", { index: step.index, block: block(step.block), value: step.value });
      case "moveBlock":
        return t("moveBlock", { index: step.index, block: block(step.block), place: place(step.place) });
      case "looseBlock":
        return t("looseBlock", { block: block(step.block) });
      case "fillGap":
        return t("fillGap", { block: block(step.block) });
      case "ruleOut":
        return t("ruleOut", { option: name(names.option, step.optionId) });
      case "answerIs":
        return t("answerIs", { option: name(names.option, step.optionId) });
      case "moveItem":
        return t("moveItem", { item: name(names.item, step.itemId), position: step.position });
      case "teach":
        return t("teach", { specimen: name(names.specimen, step.specimenId), label: names.label ? names.label(step.label) : step.label });
      case "takeBack":
        return t("takeBack", { specimen: name(names.specimen, step.specimenId) });
      case "keepForTesting":
        return t("keepForTesting", { specimen: name(names.specimen, step.specimenId) });
      case "plantFlag":
        return t("plantFlag", { spot: names.spot ? names.spot(step.size, step.color) : `${step.size}, ${step.color}` });
      case "liftFlag":
        return t("liftFlag", { index: step.index });
      case "strikeReading":
        return t("strikeReading", { specimen: name(names.specimen, step.specimenId) });
      case "restoreReading":
        return t("restoreReading", { specimen: name(names.specimen, step.specimenId) });
      case "chooseSafe":
        return t("chooseSafe", { choice: name(names.choice, step.choiceId) });
      case "nudgeLine":
        return t("nudgeLine", { end: t(`end.${step.end}`), dir: t(`dir.${step.dir}`) });
      case "revealComputer":
        return t("revealComputer");
      case "setPrediction":
        return t("setPrediction", { value: step.value });
      case "pickPicture":
        return t("pickPicture", { round: name(names.round, step.roundId), image: name(names.image, step.imageId) });
      case "designAdd":
        return t("designAdd", { tile: t(`tile.${step.tile === "#" ? "rock" : step.tile === "W" ? "water" : "carrot"}`), row: step.y + 1, col: step.x + 1 });
      case "designRemove":
        return t("designRemove", { row: step.y + 1, col: step.x + 1 });
      case "designGoal":
        return t("designGoal", { row: step.y + 1, col: step.x + 1 });
      case "designFix":
        return t("designFix");
      case "none":
        return t("none");
    }
  };
}

interface NextStepHintProps {
  levelId: string;
  action: NextStepAction;
  /** The child's current work, in the shape the server compares. */
  getState: () => NextStepStateInput;
  names?: NextStepNames;
  /** What the child presses when the work is already right ("Run", "Check"…). */
  readyAction: string;
  /** Already used on this level (an earlier session): skip the confirm. */
  usedBefore: boolean;
  /** Lets the player point at the thing the hint names (select a block, ring a card). */
  onStep?: (step: NextStep) => void;
  disabled?: boolean;
  className?: string;
  /** "button" = a normal toolbar button; "chip" = a compact pill. */
  variant?: "button" | "chip";
}

export function NextStepHint({
  levelId,
  action,
  getState,
  names = {},
  readyAction,
  usedBefore,
  onStep,
  disabled = false,
  className,
  variant = "button",
}: NextStepHintProps) {
  const t = useTranslations("student.play.nextStep");
  const text = useNextStepText();
  const [agreed, setAgreed] = useState(usedBefore);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useNarrateOnShow(message ?? "");

  const ask = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await action({ levelId, state: getState() });
      if (!result.ok) throw new Error(result.error);
      setMessage(text(result.data, names, readyAction));
      onStep?.(result.data);
    } catch {
      setFailed(true);
      setMessage(t("failed"));
    } finally {
      setLoading(false);
    }
  };

  const open = () => {
    if (!agreed) {
      setConfirming(true);
      return;
    }
    void ask();
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={disabled || loading}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border-2 border-accent bg-accent/15 font-bold text-ink transition-colors hover:bg-accent/30 disabled:opacity-50",
          variant === "chip" ? "h-10 px-3 text-sm" : "h-11 px-3 text-sm",
          className,
        )}
      >
        <span aria-hidden="true">🧭</span>
        {loading ? t("thinking") : t("button")}
      </button>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("confirmTitle")}
        closeLabel={t("confirmNo")}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setConfirming(false)}>
              {t("confirmNo")}
            </Button>
            <Button
              size="lg"
              onClick={() => {
                setAgreed(true);
                setConfirming(false);
                void ask();
              }}
            >
              {t("confirmYes")}
            </Button>
          </>
        }
      >
        <p className="text-base text-ink">{t("confirmBody")}</p>
      </Dialog>

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl border-2 border-accent bg-surface-raised p-4 shadow-raised sm:inset-x-auto sm:end-6"
        >
          <BunnyMascot state={failed ? "thinking" : "excited"} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-display text-sm font-bold text-ink">{t("title")}</p>
            <p className="text-base leading-snug text-ink">{message}</p>
            <p className="text-xs text-ink-muted">{t("capNote")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void ask()} loading={loading}>
                {t("again")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMessage(null)}>
                {t("close")}
              </Button>
              <ReadAloudButton text={message} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
