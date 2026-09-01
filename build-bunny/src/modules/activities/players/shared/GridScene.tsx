"use client";

import { useTranslations } from "next-intl";

import { BunnyMascot } from "@/ui";

/**
 * "How to play" for every block-coding level: stack blocks, press Run, the
 * bunny does them in order and reaches the carrot.
 *
 * The three coding worlds — 14 of the 37 levels, and the first hours of the
 * product for every child — explained themselves with a paragraph of prose
 * and nothing else, while the AI worlds authored later all got animated
 * walkthroughs. A Grade 3 reader meeting their first Blockly workspace is
 * exactly the reader a paragraph fails.
 *
 * Deliberate choices, carried over from TeachScene and TrendScene:
 *  - Every element is styled in its FINAL state and the keyframes animate
 *    *toward* it, so `prefers-reduced-motion` switches the motion off and
 *    the scene still reads as a diagram: three blocks, a bunny standing on
 *    the carrot tile.
 *  - Plain CSS keyframes in a <style> tag, not a library. This renders on a
 *    school tablet over classroom wifi.
 *  - Wordless. There is nothing here to translate, so an Arabic-reading
 *    child sees exactly what an English-reading one sees, and it can play
 *    on every level without a per-level authoring cost.
 *
 * The scene is `dir="ltr"` in both locales, following SimulationCanvas: grid
 * coordinates are absolute, so "move forward" walks the bunny to the RIGHT
 * in Arabic too. Mirroring the scene would teach the opposite of what the
 * level then does.
 */

const TILE = 44;
const HOPS = [0, TILE, TILE * 2, TILE * 3];

const SCENE_CSS = `
@keyframes gsc-block-in{0%{opacity:0;transform:translateX(-14px)}100%{opacity:1;transform:none}}
@keyframes gsc-lit1{0%,29%{box-shadow:none}32%,44%{box-shadow:0 0 0 3px var(--color-ink)}47%,100%{box-shadow:none}}
@keyframes gsc-lit2{0%,45%{box-shadow:none}48%,60%{box-shadow:0 0 0 3px var(--color-ink)}63%,100%{box-shadow:none}}
@keyframes gsc-lit3{0%,61%{box-shadow:none}64%,76%{box-shadow:0 0 0 3px var(--color-ink)}79%,100%{box-shadow:none}}
@keyframes gsc-run{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@keyframes gsc-hop{
  0%,30%{transform:translate(0,0)}
  36%{transform:translate(${TILE / 2}px,-13px)}
  42%,46%{transform:translate(${TILE}px,0)}
  52%{transform:translate(${TILE * 1.5}px,-13px)}
  58%,62%{transform:translate(${TILE * 2}px,0)}
  68%{transform:translate(${TILE * 2.5}px,-13px)}
  74%,100%{transform:translate(${TILE * 3}px,0)}}
@keyframes gsc-carrot{0%,72%{opacity:1;transform:scale(1)}86%,100%{opacity:0;transform:scale(1.9)}}
@keyframes gsc-sparkle{0%,74%{opacity:0;transform:scale(.4)}84%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.3)}}

.gsc-block{animation:gsc-block-in .5s cubic-bezier(.16,1,.3,1) both}
.gsc-b1{animation-delay:0s}
.gsc-b2{animation-delay:.35s}
.gsc-b3{animation-delay:.7s}
.gsc-lit1{animation:gsc-lit1 6s linear infinite}
.gsc-lit2{animation:gsc-lit2 6s linear infinite}
.gsc-lit3{animation:gsc-lit3 6s linear infinite}
.gsc-run{animation:gsc-run 6s ease-in-out infinite}
.gsc-bunny{transform:translate(${TILE * 3}px,0);animation:gsc-hop 6s ease-in-out infinite}
.gsc-carrot{animation:gsc-carrot 6s ease-in-out infinite}
.gsc-sparkle{opacity:0;animation:gsc-sparkle 6s ease-in-out infinite}

@media (prefers-reduced-motion: reduce){
  .gsc-block,.gsc-lit1,.gsc-lit2,.gsc-lit3,.gsc-run,.gsc-bunny,.gsc-carrot,.gsc-sparkle{
    animation:none !important}
  .gsc-carrot{opacity:0}
  .gsc-sparkle{opacity:1;transform:scale(1)}
}
`;

/** One instruction block. The arrow is the whole label — nothing to translate. */
function SceneBlock({ glyph, className }: { glyph: string; className: string }) {
  return (
    <div
      className={`flex h-6 w-24 items-center gap-1.5 rounded-md bg-brand px-2 text-xs font-bold text-on-brand ${className}`}
    >
      <span aria-hidden="true">{glyph}</span>
      <span aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-on-brand/35" />
    </div>
  );
}

export function GridScene() {
  const t = useTranslations("student.play.intro");

  return (
    <div
      // Absolute grid coordinates, exactly as SimulationCanvas does it.
      dir="ltr"
      role="img"
      aria-label={t("howSceneLabel")}
      className="flex items-center justify-center gap-4 rounded-xl bg-surface-sunken p-4"
    >
      <style>{SCENE_CSS}</style>

      {/* The program: three blocks, run top to bottom. */}
      <div className="flex flex-col gap-1.5">
        <SceneBlock glyph="→" className="gsc-block gsc-b1 gsc-lit1" />
        <SceneBlock glyph="→" className="gsc-block gsc-b2 gsc-lit2" />
        <SceneBlock glyph="→" className="gsc-block gsc-b3 gsc-lit3" />
        <div
          aria-hidden="true"
          className="gsc-run mt-1 self-start rounded-full bg-positive px-2.5 py-0.5 text-[10px] font-bold text-on-brand"
        >
          ▶
        </div>
      </div>

      {/* The world: four tiles, a carrot at the end, the bunny walking it. */}
      <div className="relative" style={{ width: TILE * 4, height: TILE + 18 }}>
        <div className="absolute bottom-0 flex">
          {HOPS.map((offset) => (
            <div
              key={offset}
              aria-hidden="true"
              className="border border-border-token bg-surface"
              style={{ width: TILE, height: TILE }}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          className="gsc-carrot absolute bottom-2 text-xl"
          style={{ left: TILE * 3 + 12 }}
        >
          🥕
        </span>
        <span
          aria-hidden="true"
          className="gsc-sparkle absolute bottom-3 text-lg"
          style={{ left: TILE * 3 + 14 }}
        >
          ✨
        </span>
        <div className="gsc-bunny absolute bottom-1 left-0" style={{ width: TILE }}>
          <BunnyMascot state="idle" size="xs" />
        </div>
      </div>
    </div>
  );
}
