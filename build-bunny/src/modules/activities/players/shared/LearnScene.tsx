"use client";

import { useTranslations } from "next-intl";

/**
 * "How to play" for a Learn step: the program is already written, one block
 * has been taken out, and your job is to put it back.
 *
 * A Learn step has no failure state, but it does have a shape a child has to
 * recognise before the words make sense — that the workspace in front of
 * them is a finished program with a hole in it, not a blank page. Getting
 * that wrong is not hypothetical: robot-lab/learn-if-else shipped with its
 * instructions pointing at the wrong mouth of the If/Else block, and a child
 * who had not understood "there is exactly one gap" had no way to notice.
 *
 * Wordless and, like GridScene, dir="ltr" — the blocks below stand for a
 * Blockly stack, and Blockly's own workspace mirrors, but what this scene
 * teaches is vertical: a hole in the middle of a list, filled from outside.
 * Same final-state-plus-keyframes rule so prefers-reduced-motion leaves a
 * readable diagram: three blocks in place and a tick.
 */

const SCENE_CSS = `
@keyframes lsc-gap{0%,18%{opacity:1}22%,100%{opacity:0}}
@keyframes lsc-drop{
  0%,16%{transform:translate(30px,34px);opacity:1}
  30%{transform:translate(2px,2px);opacity:1}
  34%,100%{transform:translate(0,0);opacity:1}}
@keyframes lsc-hand{0%,14%{opacity:1}32%,100%{opacity:0}}
@keyframes lsc-lit1{0%,44%{box-shadow:none}47%,57%{box-shadow:0 0 0 3px var(--color-ink)}60%,100%{box-shadow:none}}
@keyframes lsc-lit2{0%,59%{box-shadow:none}62%,70%{box-shadow:0 0 0 3px var(--color-ink)}73%,100%{box-shadow:none}}
@keyframes lsc-lit3{0%,72%{box-shadow:none}75%,83%{box-shadow:0 0 0 3px var(--color-ink)}86%,100%{box-shadow:none}}
@keyframes lsc-tick{0%,84%{opacity:0;transform:scale(.4)}92%,100%{opacity:1;transform:scale(1)}}

.lsc-gap{opacity:0;animation:lsc-gap 6s ease-in-out infinite}
.lsc-drop{animation:lsc-drop 6s cubic-bezier(.16,1,.3,1) infinite}
.lsc-hand{opacity:0;animation:lsc-hand 6s ease-in-out infinite}
.lsc-lit1{animation:lsc-lit1 6s linear infinite}
.lsc-lit2{animation:lsc-lit2 6s linear infinite}
.lsc-lit3{animation:lsc-lit3 6s linear infinite}
.lsc-tick{animation:lsc-tick 6s ease-out infinite}

@media (prefers-reduced-motion: reduce){
  .lsc-gap,.lsc-drop,.lsc-hand,.lsc-lit1,.lsc-lit2,.lsc-lit3,.lsc-tick{animation:none !important}
  .lsc-gap,.lsc-hand{opacity:0}
  .lsc-tick{opacity:1;transform:scale(1)}
}
`;

function Block({ glyph, className = "" }: { glyph: string; className?: string }) {
  return (
    <div
      className={`flex h-6 w-24 items-center gap-1.5 rounded-md bg-brand px-2 text-xs font-bold text-on-brand ${className}`}
    >
      <span aria-hidden="true">{glyph}</span>
      <span aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-on-brand/35" />
    </div>
  );
}

export function LearnScene() {
  const t = useTranslations("student.play.intro");

  return (
    <div
      dir="ltr"
      role="img"
      aria-label={t("learnSceneLabel")}
      className="flex items-center justify-center gap-5 rounded-xl bg-surface-sunken p-4"
    >
      <style>{SCENE_CSS}</style>

      <div className="relative flex flex-col gap-1.5">
        <Block glyph="→" className="lsc-lit1" />

        {/* The gap, and the block that fills it. The dashed outline sits
            under the arriving block and fades as it lands. */}
        <div className="relative h-6 w-24">
          <div
            aria-hidden="true"
            className="lsc-gap absolute inset-0 rounded-md border-2 border-dashed border-ink/30"
          />
          <div className="lsc-drop absolute inset-0">
            <Block glyph="↻" className="lsc-lit2" />
          </div>
        </div>

        <Block glyph="→" className="lsc-lit3" />

        <span
          aria-hidden="true"
          className="lsc-hand pointer-events-none absolute text-base"
          style={{ left: 96, top: 56 }}
        >
          👆
        </span>
      </div>

      <span aria-hidden="true" className="lsc-tick text-2xl">
        ✅
      </span>
    </div>
  );
}
