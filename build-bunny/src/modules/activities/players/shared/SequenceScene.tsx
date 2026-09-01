"use client";

import { useTranslations } from "next-intl";

/**
 * "How to play" for a sequencing level: the steps are all here, but in the
 * wrong order — move one up until the routine reads correctly.
 *
 * The player offers both drag and up/down buttons, and the buttons are the
 * primary affordance (drag-only was never acceptable on a school tablet).
 * The scene shows a card MOVING rather than a hand dragging, so it does not
 * quietly advertise the one input method some children cannot use.
 *
 * Wordless, and the same final-state-plus-keyframes rule as the other
 * scenes: with motion off it settles into an ordered list with a tick.
 */

const ROW = 30;

const SCENE_CSS = `
@keyframes sqs-up{0%,22%{transform:translateY(${ROW}px)}44%,100%{transform:translateY(0)}}
@keyframes sqs-down{0%,22%{transform:translateY(-${ROW}px)}44%,100%{transform:translateY(0)}}
@keyframes sqs-press{0%,20%{transform:scale(1)}28%{transform:scale(.86)}36%,100%{transform:scale(1)}}
@keyframes sqs-tick{0%,52%{opacity:0;transform:scale(.4)}64%,100%{opacity:1;transform:scale(1)}}

.sqs-up{animation:sqs-up 5s cubic-bezier(.16,1,.3,1) infinite}
.sqs-down{animation:sqs-down 5s cubic-bezier(.16,1,.3,1) infinite}
.sqs-press{animation:sqs-press 5s ease-in-out infinite}
.sqs-tick{animation:sqs-tick 5s ease-out infinite}

@media (prefers-reduced-motion: reduce){
  .sqs-up,.sqs-down,.sqs-press,.sqs-tick{animation:none !important}
  .sqs-tick{opacity:1;transform:scale(1)}
}
`;

function Card({ n, className = "" }: { n: number; className?: string }) {
  return (
    <div
      className={`flex h-6 w-28 items-center gap-2 rounded-md border border-border-token bg-surface px-2 ${className}`}
    >
      <span
        aria-hidden="true"
        className="grid size-4 place-items-center rounded-full bg-brand text-[10px] font-bold text-on-brand"
      >
        {n}
      </span>
      <span aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-ink/15" />
      <span aria-hidden="true" className="text-[9px] text-ink-muted">
        ▲▼
      </span>
    </div>
  );
}

export function SequenceScene() {
  const t = useTranslations("student.play.intro");

  return (
    <div
      dir="ltr"
      role="img"
      aria-label={t("sequenceSceneLabel")}
      className="flex items-center justify-center gap-4 rounded-xl bg-surface-sunken p-4"
    >
      <style>{SCENE_CSS}</style>

      {/* Two cards trade places: the one that belongs first rises past the
          one that was above it. Nothing is added or removed — reordering is
          the whole game. */}
      <div className="flex flex-col gap-1.5">
        <div className="sqs-up">
          <Card n={1} className="sqs-press" />
        </div>
        <div className="sqs-down">
          <Card n={2} />
        </div>
        <Card n={3} />
      </div>

      <span aria-hidden="true" className="sqs-tick text-2xl">
        ✅
      </span>
    </div>
  );
}
