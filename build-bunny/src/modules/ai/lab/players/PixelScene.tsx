"use client";

/**
 * The animated explanation for "See Like a Computer" (pixel-playground).
 *
 * The level hands a child a resolution slider and a set of mystery images
 * with no account of why any of it matters. These four beats give one:
 *
 *   1. a picture is really a grid of coloured squares
 *   2. fewer squares means less detail — the picture gets blockier
 *   3. a computer never sees the picture, only the numbers in the grid
 *   4. so the game is: can you still tell what it is?
 *
 * Same construction rules as the other two scenes: final-state styling with
 * keyframes animating toward it (reduced motion leaves a readable diagram),
 * plain CSS keyframes, and no dependence on colour alone.
 */

const SCENE_CSS = `
@keyframes pxs-grid-in{0%{opacity:0}100%{opacity:1}}
@keyframes pxs-block-in{0%{opacity:0;transform:scale(.55)}100%{opacity:1;transform:none}}
@keyframes pxs-coarsen{0%{opacity:0}100%{opacity:1}}
@keyframes pxs-number-in{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:none}}
@keyframes pxs-think{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}

.pxs-grid{animation:pxs-grid-in .8s ease-out both}
.pxs-block{transform-box:fill-box;transform-origin:50% 50%;animation:pxs-block-in .45s cubic-bezier(.16,1,.3,1) both}
.pxs-coarse{animation:pxs-coarsen .9s ease-out .3s both}
.pxs-number{animation:pxs-number-in .5s ease-out both}
.pxs-think{transform-box:fill-box;transform-origin:50% 50%;animation:pxs-think 1.6s ease-in-out infinite}

@media (prefers-reduced-motion: reduce){
  .pxs-grid,.pxs-block,.pxs-coarse,.pxs-number,.pxs-think{animation:none !important}
}
`;

/**
 * A tiny 8×8 "house": the same picture at fine and coarse resolution, so the
 * child sees ONE thing losing detail rather than two unrelated pictures.
 * 1 = filled, 0 = background.
 */
const HOUSE = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
];

/** Halve the grid by averaging each 2×2 block — real downsampling, drawn. */
const COARSE = Array.from({ length: 4 }, (_, r) =>
  Array.from({ length: 4 }, (_, c) => {
    const sum =
      HOUSE[r * 2]![c * 2]! +
      HOUSE[r * 2]![c * 2 + 1]! +
      HOUSE[r * 2 + 1]![c * 2]! +
      HOUSE[r * 2 + 1]![c * 2 + 1]!;
    return sum / 4;
  }),
);

function Grid({
  cells,
  size,
  x,
  y,
  animate = false,
  showValues = false,
}: {
  cells: number[][];
  size: number;
  x: number;
  y: number;
  animate?: boolean;
  showValues?: boolean;
}) {
  return (
    <g>
      {cells.map((row, r) =>
        row.map((value, c) => (
          <g key={`${r}-${c}`}>
            <rect
              x={x + c * size}
              y={y + r * size}
              width={size}
              height={size}
              className={animate ? "pxs-block fill-brand" : "fill-brand"}
              style={{
                opacity: value === 0 ? 0.08 : 0.25 + value * 0.75,
                ...(animate ? { animationDelay: `${(r * row.length + c) * 18}ms` } : {}),
              }}
            />
            <rect
              x={x + c * size}
              y={y + r * size}
              width={size}
              height={size}
              className="fill-none stroke-border-token"
              strokeWidth="0.5"
            />
            {showValues ? (
              <text
                x={x + c * size + size / 2}
                y={y + r * size + size / 2 + 3}
                textAnchor="middle"
                className="pxs-number fill-ink text-[7px] font-bold"
                style={{ animationDelay: `${(r * row.length + c) * 40}ms` }}
              >
                {Math.round(value * 9)}
              </text>
            ) : null}
          </g>
        )),
      )}
    </g>
  );
}

export function PixelScene({ step }: { step: number }) {
  return (
    <div className="grid min-h-40 place-items-center overflow-hidden rounded-xl bg-surface p-3">
      <style>{SCENE_CSS}</style>
      <svg viewBox="0 0 250 118" className="h-auto w-full" style={{ direction: "ltr" }} aria-hidden="true">
        {/* 1 — a picture is a grid of squares. */}
        {step === 1 ? (
          <g className="pxs-grid">
            <Grid cells={HOUSE} size={12} x={77} y={11} animate />
          </g>
        ) : null}

        {/* 2 — fewer squares, less detail: the SAME picture, coarser. */}
        {step === 2 ? (
          <>
            <Grid cells={HOUSE} size={11} x={22} y={15} />
            <text x="66" y="112" textAnchor="middle" className="fill-ink-muted text-[9px] font-bold">
              8 × 8
            </text>
            <text x="125" y="66" textAnchor="middle" className="fill-ink-muted text-[14px]">
              →
            </text>
            <g className="pxs-coarse">
              <Grid cells={COARSE} size={22} x={150} y={15} />
              <text x="194" y="112" textAnchor="middle" className="fill-ink-muted text-[9px] font-bold">
                4 × 4
              </text>
            </g>
          </>
        ) : null}

        {/* 3 — what the computer actually gets: numbers, not a picture. */}
        {step === 3 ? (
          <>
            <Grid cells={COARSE} size={22} x={40} y={15} />
            <text x="140" y="66" textAnchor="middle" className="fill-ink-muted text-[14px]">
              →
            </text>
            <Grid cells={COARSE} size={22} x={160} y={15} showValues />
          </>
        ) : null}

        {/* 4 — so: can you still tell what it is? */}
        {step === 4 ? (
          <>
            <Grid cells={COARSE} size={22} x={62} y={15} />
            <g className="pxs-think">
              <text x="182" y="60" textAnchor="middle" className="fill-ink text-[26px] font-bold">
                ?
              </text>
            </g>
          </>
        ) : null}
      </svg>
    </div>
  );
}
