"use client";

import { DEFAULT_GLYPH_THEME, glyphFill, glyphShapeStyle, glyphTheme } from "@/modules/ai/glyph";

/**
 * The animated explanation for the Grouping Machine, four beats:
 *
 *  1 — dots with no labels: nobody has written anything on this data.
 *  2 — a flag lands and the nearest dots reach to it: a "group" is only
 *      "the things nearest this flag", there is no other definition.
 *  3 — the meter: tight piles score high, a flag in the gap scores low.
 *  4 — either the odd-one-out (exclusion levels) or the flags WALKING
 *      (training levels): the machine repeats one step until nothing moves.
 *
 * Same construction rules as TeachScene: every element styled in its final
 * state, keyframes animate toward it, so reduced-motion degrades to a
 * static diagram. Direction-safe by construction — the scenes are symmetric
 * compositions, and the shared flow/pop keyframes already handle RTL.
 */

const SCENE_CSS = `
@keyframes bbg-appear{0%{opacity:0;transform:scale(.4)}100%{opacity:1;transform:scale(1)}}
@keyframes bbg-reach{0%,15%{opacity:0;transform:scaleX(0)}55%,100%{opacity:.5;transform:scaleX(1)}}
@keyframes bbg-fill-good{0%,20%{width:8%}70%,100%{width:88%}}
@keyframes bbg-fill-bad{0%,20%{width:8%}70%,100%{width:34%}}
@keyframes bbg-walk-a{0%,20%{transform:translate(0,0)}60%,100%{transform:translate(26px,-10px)}}
@keyframes bbg-walk-b{0%,20%{transform:translate(0,0)}60%,100%{transform:translate(-22px,12px)}}
@keyframes bbg-strike{0%,40%{opacity:1;filter:none}75%,100%{opacity:.25;filter:grayscale(1)}}
.bbg-appear{animation:bbg-appear .6s ease-out both}
.bbg-reach{transform-origin:left;animation:bbg-reach 2.6s ease-out infinite}
html[dir="rtl"] .bbg-reach{transform-origin:right}
.bbg-fill-good{animation:bbg-fill-good 2.8s ease-in-out infinite}
.bbg-fill-bad{animation:bbg-fill-bad 2.8s ease-in-out infinite}
.bbg-walk-a{animation:bbg-walk-a 2.6s ease-in-out infinite}
.bbg-walk-b{animation:bbg-walk-b 2.6s ease-in-out infinite .3s}
.bbg-strike{animation:bbg-strike 2.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){
  .bbg-appear,.bbg-reach,.bbg-fill-good,.bbg-fill-bad,.bbg-walk-a,.bbg-walk-b,.bbg-strike{animation:none}
}
`;

function Dot({
  color,
  size = 16,
  glyph,
  className,
  delay,
}: {
  color: number;
  size?: number;
  glyph: string;
  className?: string;
  delay?: number;
}) {
  const def = glyphTheme(glyph);
  return (
    <span
      aria-hidden="true"
      className={`bbg-appear inline-block border-2 border-ink/15 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: glyphFill(def, color),
        ...glyphShapeStyle(def),
        animationDelay: delay ? `${delay}ms` : undefined,
      }}
    />
  );
}

export function GroupScene({
  step,
  glyph = DEFAULT_GLYPH_THEME,
  training,
}: {
  step: number;
  glyph?: string;
  training: boolean;
}) {
  return (
    <div className="grid min-h-40 place-items-center overflow-hidden rounded-xl bg-surface p-3">
      <style>{SCENE_CSS}</style>

      {/* 1 — unlabelled dots, appearing one by one. No names anywhere. */}
      {step === 1 ? (
        <div className="relative h-32 w-64">
          {[
            [12, 20, 0.2], [22, 34, 0.25], [30, 16, 0.3], [18, 44, 0.22],
            [72, 70, 0.75], [82, 82, 0.8], [76, 58, 0.72], [88, 68, 0.78],
          ].map(([x, y, c], i) => (
            <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
              <Dot color={c as number} glyph={glyph} delay={i * 150} />
            </span>
          ))}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-1 text-center text-2xl"
          >
            📷
          </span>
        </div>
      ) : null}

      {/* 2 — a flag lands; its nearest dots reach to it with lines. */}
      {step === 2 ? (
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            {[0.2, 0.28, 0.24].map((c, i) => (
              <div key={i} className="flex items-center gap-1">
                <Dot color={c} glyph={glyph} />
                <span className="bbg-reach block h-0.5 w-10 rounded-full bg-ink" />
              </div>
            ))}
          </div>
          <span aria-hidden="true" className="text-3xl">
            🚩
          </span>
          <div className="w-10" />
          <div className="flex flex-col gap-2 opacity-40">
            {[0.75, 0.8].map((c, i) => (
              <Dot key={i} color={c} glyph={glyph} />
            ))}
          </div>
        </div>
      ) : null}

      {/* 3 — the meter: piles score, a flag in the gap does not. */}
      {step === 3 ? (
        <div className="flex w-full max-w-xs flex-col gap-4">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-xl">
              🚩
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span className="bbg-fill-good absolute inset-y-0 start-0 rounded-full bg-brand" />
            </div>
            <span aria-hidden="true">😊</span>
          </div>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-xl opacity-60">
              🚩
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span className="bbg-fill-bad absolute inset-y-0 start-0 rounded-full bg-danger/70" />
            </div>
            <span aria-hidden="true">🤔</span>
          </div>
        </div>
      ) : null}

      {/* 4 — training levels: the flags WALK. Otherwise: the odd one out. */}
      {step === 4 ? (
        training ? (
          <div className="relative h-32 w-64">
            {[
              [14, 24, 0.2], [24, 38, 0.25], [32, 20, 0.3],
              [68, 66, 0.75], [80, 78, 0.8], [74, 56, 0.72],
            ].map(([x, y, c], i) => (
              <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
                <Dot color={c as number} glyph={glyph} />
              </span>
            ))}
            <span aria-hidden="true" className="bbg-walk-a absolute text-2xl" style={{ left: "8%", top: "50%" }}>
              🚩
            </span>
            <span aria-hidden="true" className="bbg-walk-b absolute text-2xl" style={{ left: "80%", top: "30%" }}>
              🚩
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {[0.22, 0.26, 0.3].map((c, i) => (
              <Dot key={i} color={c} glyph={glyph} size={18} />
            ))}
            <span className="bbg-strike relative inline-block">
              <Dot color={0.95} glyph={glyph} size={26} />
              <span
                aria-hidden="true"
                className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-bold text-surface-raised"
              >
                ✗
              </span>
            </span>
          </div>
        )
      ) : null}
    </div>
  );
}
