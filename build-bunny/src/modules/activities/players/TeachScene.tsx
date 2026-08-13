"use client";

import {
  DEFAULT_GLYPH_THEME,
  glyphFill,
  glyphPx,
  glyphShapeStyle,
  glyphTheme,
  MYSTERY_FILL,
} from "@/modules/ai/glyph";

/**
 * The animated explanation that plays behind each walkthrough step.
 *
 * It exists because the activity was unguessable from prose. Two adults and
 * the product owner read the instructions and still could not say what the
 * game was asking — so the fix is not more words, it is showing the mechanic
 * happening: berries moving into baskets, and a new berry reaching across to
 * the taught berry it resembles.
 *
 * Deliberate choices:
 *  - Every animated element is styled in its FINAL state, and the keyframes
 *    animate *toward* that state. So `prefers-reduced-motion` can switch the
 *    animation off wholesale and the scene still reads as a diagram rather
 *    than collapsing to a pile of invisible elements.
 *  - Plain CSS keyframes in a <style> tag, not a library: this is four short
 *    loops on one screen, and it must not add to a bundle a school tablet has
 *    to download over classroom wifi.
 *  - Scene 4 shows the model getting it WRONG. The trap in the real level is
 *    teaching only small berries, and a child who has watched that fail once
 *    knows what "cover every kind" means.
 */

/**
 * Direction is handled in CSS, not JS: `--bbw-x` flips sign under
 * html[dir="rtl"] and every horizontal motion is expressed in terms of it.
 * Reading document.dir in an effect would render the first frame with the
 * berries flying into the wrong baskets in Arabic.
 */
const SCENE_CSS = `
.bbw-scene{--bbw-x:58px}
html[dir="rtl"] .bbw-scene{--bbw-x:-58px}
@keyframes bbw-wobble{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes bbw-blink{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes bbw-fly-a{0%{transform:translate(0,0);opacity:0}12%{opacity:1}55%,88%{transform:translate(calc(-1 * var(--bbw-x)),62px);opacity:1}100%{transform:translate(calc(-1 * var(--bbw-x)),62px);opacity:0}}
@keyframes bbw-fly-b{0%{transform:translate(0,0);opacity:0}12%{opacity:1}55%,88%{transform:translate(var(--bbw-x),62px);opacity:1}100%{transform:translate(var(--bbw-x),62px);opacity:0}}
@keyframes bbw-reach{0%,8%{transform:scaleX(0)}48%,100%{transform:scaleX(1)}}
@keyframes bbw-pop{0%,48%{opacity:0;transform:scale(.5)}64%,100%{opacity:1;transform:scale(1)}}
.bbw-wobble{animation:bbw-wobble 1.6s ease-in-out infinite}
.bbw-blink{animation:bbw-blink 1.4s ease-in-out infinite}
.bbw-fly-a{transform:translate(calc(-1 * var(--bbw-x)),62px);animation:bbw-fly-a 3s ease-in-out infinite}
.bbw-fly-b{transform:translate(var(--bbw-x),62px);animation:bbw-fly-b 3s ease-in-out infinite .5s}
.bbw-reach{transform-origin:left;animation:bbw-reach 3.4s ease-out infinite}
html[dir="rtl"] .bbw-reach{transform-origin:right}
.bbw-pop{animation:bbw-pop 3.4s ease-out infinite}
@media (prefers-reduced-motion: reduce){
  .bbw-wobble,.bbw-blink,.bbw-fly-a,.bbw-fly-b,.bbw-reach,.bbw-pop{animation:none !important}
}
`;

function SceneBerry({
  size,
  color,
  className,
  style,
  mystery,
  theme = DEFAULT_GLYPH_THEME,
}: {
  size: number;
  color: number;
  className?: string;
  style?: React.CSSProperties;
  mystery?: boolean;
  theme?: string;
}) {
  // Geometry comes from the shared module, never re-typed here: the scene
  // teaches the child how to read the board, so a glyph that meant something
  // different in the two places would be actively misleading.
  const glyph = glyphTheme(theme);
  const px = glyphPx(glyph, size);
  return (
    <span className={`relative inline-block shrink-0 ${className ?? ""}`} style={style}>
      <span
        aria-hidden="true"
        className="block border-2 border-ink/15"
        style={{
          width: px,
          height: px,
          background: mystery ? MYSTERY_FILL : glyphFill(glyph, color),
          ...glyphShapeStyle(glyph),
        }}
      />
      {mystery ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center text-sm font-bold text-ink"
        >
          ?
        </span>
      ) : null}
    </span>
  );
}

function Chip({
  tone,
  children,
  className,
  style,
}: {
  tone: "safe" | "unsafe";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        tone === "safe" ? "bg-brand/15 text-brand" : "bg-danger/15 text-danger"
      } ${className ?? ""}`}
      style={style}
    >
      {children}
    </span>
  );
}

/**
 * Probe on the left reaching out to two taught berries on the right: the
 * solid line grows to the one it looks most like, then that berry's answer
 * pops up under the probe. This is the whole of 1-nearest-neighbour, drawn.
 */
function MatchScene({
  probe,
  near,
  far,
  answer,
  correct,
  labels,
}: {
  probe: { size: number; color: number };
  near: { size: number; color: number; tone: "safe" | "unsafe" };
  far: { size: number; color: number; tone: "safe" | "unsafe" };
  answer: "safe" | "unsafe";
  correct: boolean;
  labels: { positive: string; negative: string };
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex w-24 flex-col items-center gap-1.5">
        <SceneBerry size={probe.size} color={probe.color} mystery />
        <Chip tone={answer} className="bbw-pop">
          <span aria-hidden="true">{correct ? "✓" : "✗"}</span>
          {answer === "safe" ? labels.positive : labels.negative}
        </Chip>
      </div>

      <div className="flex flex-col gap-6">
        <span className="bbw-reach block h-1 w-14 rounded-full bg-ink/70" />
        <span
          className="block h-1 w-14 rounded-full border-t-2 border-dashed border-ink/20 opacity-40"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <SceneBerry size={near.size} color={near.color} />
          <Chip tone={near.tone}>
            {near.tone === "safe" ? labels.positive : labels.negative}
          </Chip>
        </div>
        <div className="flex items-center gap-1.5 opacity-40">
          <SceneBerry size={far.size} color={far.color} />
          <Chip tone={far.tone}>
            {far.tone === "safe" ? labels.positive : labels.negative}
          </Chip>
        </div>
      </div>
    </div>
  );
}

export function TeachScene({
  step,
  labels,
}: {
  step: number;
  labels: { positive: string; negative: string };
}) {
  return (
    <div className="bbw-scene grid min-h-40 place-items-center overflow-hidden rounded-xl bg-surface p-3">
      <style>{SCENE_CSS}</style>

      {/* 1 — the bunny has no rule and cannot read one. */}
      {step === 1 ? (
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="bbw-wobble text-5xl"
          >
            🐰
          </span>
          <span
            aria-hidden="true"
            className="bbw-blink text-3xl"
          >
            🤔
          </span>
          <div className="flex gap-2">
            <SceneBerry size={0.2} color={0.15} mystery />
            <SceneBerry size={0.8} color={0.85} mystery />
          </div>
        </div>
      ) : null}

      {/* 2 — berries the bunny already tried, going into the two baskets. */}
      {step === 2 ? (
        <div className="relative h-36 w-64">
          <SceneBerry
            size={0.25}
            color={0.15}
            className="bbw-fly-a absolute start-[calc(50%-34px)] top-1"
          />
          <SceneBerry
            size={0.7}
            color={0.9}
            className="bbw-fly-b absolute start-[calc(50%+6px)] top-1"
          />
          <div className="absolute bottom-0 start-0 flex flex-col items-center gap-1">
            <span aria-hidden="true" className="text-2xl">
              🧺
            </span>
            <Chip tone="safe">{labels.positive}</Chip>
          </div>
          <div className="absolute bottom-0 end-0 flex flex-col items-center gap-1">
            <span aria-hidden="true" className="text-2xl">
              🧺
            </span>
            <Chip tone="unsafe">{labels.negative}</Chip>
          </div>
        </div>
      ) : null}

      {/* 3 — a new berry copies the answer of whichever taught berry it most
          resembles. Here that works. */}
      {step === 3 ? (
        <MatchScene
          probe={{ size: 0.2, color: 0.2 }}
          near={{ size: 0.25, color: 0.12, tone: "safe" }}
          far={{ size: 0.3, color: 0.9, tone: "unsafe" }}
          answer="safe"
          correct
          labels={labels}
        />
      ) : null}

      {/* 4 — the same machinery, taught only small berries: a BIG one now
          resembles the wrong thing and the bunny is confidently wrong. */}
      {step === 4 ? (
        <MatchScene
          probe={{ size: 0.95, color: 0.2 }}
          near={{ size: 0.9, color: 0.85, tone: "unsafe" }}
          far={{ size: 0.15, color: 0.12, tone: "safe" }}
          answer="unsafe"
          correct={false}
          labels={labels}
        />
      ) : null}
    </div>
  );
}
