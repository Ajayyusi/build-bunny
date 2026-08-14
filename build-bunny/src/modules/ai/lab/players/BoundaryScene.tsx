"use client";

/**
 * The animated explanation for "You Be the Classifier" (boundary-builder).
 *
 * The level drops a child onto a scatter of coloured dots and asks them to
 * drag a line, without ever showing what the line is FOR. These four beats
 * answer that before they touch anything:
 *
 *   1. someone tasted these — the colours are real, known answers
 *   2. your line goes in the GAP between the two groups
 *   3. tilting beats sliding: a diagonal can separate what flat cannot
 *   4. the point of the line: it sorts fruit nobody has tasted
 *
 * Same construction rules as TeachScene and TrendScene: final-state styling
 * with keyframes animating toward it, so reduced motion leaves a readable
 * diagram; plain CSS keyframes, no animation library; and the chart stays
 * LTR in both locales because the axes mean something.
 */

const SCENE_CSS = `
@keyframes bsc-pop{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:none}}
@keyframes bsc-sweep{0%{opacity:0;stroke-dashoffset:260}30%{opacity:1}100%{opacity:1;stroke-dashoffset:0}}
@keyframes bsc-tilt{0%{transform:rotate(13deg)}100%{transform:rotate(0)}}
@keyframes bsc-drop{0%{opacity:0;transform:translateY(-18px)}70%{opacity:1}100%{opacity:1;transform:none}}
@keyframes bsc-recolour{0%{fill:var(--color-ink-faint)}100%{fill:var(--color-brand)}}
@keyframes bsc-wobble{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}

.bsc-dot{transform-box:fill-box;transform-origin:50% 50%;animation:bsc-pop .45s cubic-bezier(.16,1,.3,1) both}
.bsc-line{stroke-dasharray:260;animation:bsc-sweep 1.2s ease-out both}
.bsc-tilt{transform-box:fill-box;transform-origin:50% 50%;animation:bsc-tilt 1.5s ease-in-out both}
.bsc-new{transform-box:fill-box;transform-origin:50% 50%;animation:bsc-drop 1s cubic-bezier(.16,1,.3,1) both}
.bsc-recolour{animation:bsc-recolour 1s ease-in-out 1s both}
.bsc-wobble{transform-box:fill-box;transform-origin:50% 50%;animation:bsc-wobble 1.4s ease-in-out infinite}

@media (prefers-reduced-motion: reduce){
  .bsc-dot,.bsc-line,.bsc-tilt,.bsc-new,.bsc-recolour,.bsc-wobble{animation:none !important}
  .bsc-recolour{fill:var(--color-brand)}
}
`;

/** Tart fruit: small and sharp — lower left. */
const TART: [number, number][] = [
  [40, 84],
  [58, 66],
  [74, 90],
  [90, 72],
  [66, 48],
  [104, 92],
];
/** Sweet fruit: bigger and sweeter — upper right. */
const SWEET: [number, number][] = [
  [150, 34],
  [168, 56],
  [186, 28],
  [200, 50],
  [164, 20],
  [130, 44],
];

/**
 * Circles for tart, diamonds for sweet — matching the real widget's own
 * legend. Two reasons: a child who meets circles here and diamonds in the
 * game has to re-learn the board, and shape carries the grouping for anyone
 * who cannot separate the two hues.
 */
function Dots({ animate }: { animate: boolean }) {
  return (
    <>
      {TART.map(([x, y], i) => (
        <circle
          key={`t${x}-${y}`}
          cx={x}
          cy={y}
          r="5"
          className={animate ? "bsc-dot fill-danger" : "fill-danger"}
          style={animate ? { animationDelay: `${i * 70}ms` } : undefined}
        />
      ))}
      {SWEET.map(([x, y], i) => (
        <polygon
          key={`s${x}-${y}`}
          points={`${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`}
          className={animate ? "bsc-dot fill-brand" : "fill-brand"}
          style={animate ? { animationDelay: `${(i + TART.length) * 70}ms` } : undefined}
        />
      ))}
    </>
  );
}

function Axes() {
  return (
    <g>
      <line x1="18" y1="106" x2="238" y2="106" className="stroke-border-token" strokeWidth="1.5" />
      <line x1="18" y1="10" x2="18" y2="106" className="stroke-border-token" strokeWidth="1.5" />
    </g>
  );
}

export function BoundaryScene({ step }: { step: number }) {
  return (
    <div className="grid min-h-40 place-items-center overflow-hidden rounded-xl bg-surface p-3">
      <style>{SCENE_CSS}</style>
      <svg viewBox="0 0 250 118" className="h-auto w-full" style={{ direction: "ltr" }} aria-hidden="true">
        <Axes />

        {/* 1 — the colours are answers somebody already knows. */}
        {step === 1 ? <Dots animate /> : null}

        {/* 2 — the line goes in the empty gap between the groups. */}
        {step === 2 ? (
          <>
            <Dots animate={false} />
            <line
              x1="118"
              y1="112"
              x2="126"
              y2="8"
              className="bsc-line stroke-ink"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        ) : null}

        {/* 3 — tilting separates what a straight line cannot. */}
        {step === 3 ? (
          <>
            <Dots animate={false} />
            <g className="bsc-tilt">
              <line
                x1="112"
                y1="114"
                x2="140"
                y2="6"
                className="stroke-ink"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
            {/* the awkward pair the level is really about */}
            <circle cx="104" cy="92" r="7.5" className="bsc-wobble fill-none stroke-warning" strokeWidth="2" />
            <circle cx="130" cy="44" r="7.5" className="bsc-wobble fill-none stroke-warning" strokeWidth="2" />
          </>
        ) : null}

        {/* 4 — a fruit nobody tasted gets sorted by the side it lands on. */}
        {step === 4 ? (
          <>
            <Dots animate={false} />
            <line
              x1="112"
              y1="114"
              x2="140"
              y2="6"
              className="stroke-ink"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <g className="bsc-new">
              <circle cx="182" cy="76" r="6.5" className="bsc-recolour fill-ink-faint stroke-ink/40" strokeWidth="1.5" />
              <text x="182" y="60" textAnchor="middle" className="fill-ink-muted text-[11px] font-bold">
                ?
              </text>
            </g>
          </>
        ) : null}
      </svg>
    </div>
  );
}
