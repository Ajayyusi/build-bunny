"use client";

/**
 * The animated explanation for "Fortune Teller" (trend-line).
 *
 * Written for the same reason TeachScene was: an adult read this level's
 * instructions and could not say what it was asking. Prose describing a
 * moving idea does not work — you have to show the idea moving.
 *
 * Four beats, one idea each:
 *   1. the dots are real, messy measurements
 *   2. your line goes through the MIDDLE — "miss" is the gap you shrink
 *   3. the computer finds the one line with the smallest possible miss
 *   4. predicting past the data gives a RANGE, not a number
 *
 * Deliberate choices, both carried over from TeachScene:
 *  - Every animated element is styled in its FINAL state and the keyframes
 *    animate *toward* it, so `prefers-reduced-motion` can switch the motion
 *    off wholesale and each beat still reads as a labelled diagram rather
 *    than collapsing to invisible elements.
 *  - Plain CSS keyframes in a <style> tag, not a library: four short loops
 *    on one screen must not add to a bundle a school tablet downloads over
 *    classroom wifi.
 *
 * The scene is a chart, so it stays LTR in both locales — the same rule the
 * simulation canvas and the real trend-line chart follow. A mirrored chart
 * would put "more sunlight" on the left in Arabic and teach the wrong thing.
 */

const SCENE_CSS = `
@keyframes trs-dot-in{0%{opacity:0;transform:translateY(8px) scale(.4)}100%{opacity:1;transform:none}}
@keyframes trs-tilt{0%{transform:rotate(-14deg)}100%{transform:rotate(0)}}
@keyframes trs-shrink{0%{transform:scaleY(3.4);opacity:.55}100%{transform:scaleY(1);opacity:.9}}
@keyframes trs-dash-in{0%{stroke-dashoffset:220;opacity:0}25%{opacity:1}100%{stroke-dashoffset:0;opacity:1}}
@keyframes trs-band-grow{0%{transform:scaleY(0);opacity:0}60%{opacity:1}100%{transform:scaleY(1);opacity:1}}
@keyframes trs-reach{0%{stroke-dashoffset:90}100%{stroke-dashoffset:0}}
@keyframes trs-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.85}}
@keyframes trs-fade-up{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}

.trs-dot{transform-box:fill-box;transform-origin:50% 50%;animation:trs-dot-in .5s cubic-bezier(.16,1,.3,1) both}
.trs-line{transform-box:fill-box;transform-origin:50% 50%;animation:trs-tilt 1.4s ease-in-out both}
.trs-miss{transform-box:fill-box;transform-origin:50% 100%;opacity:.85;animation:trs-shrink 1.6s ease-in-out both}
.trs-robot-line{stroke-dasharray:8 6;animation:trs-dash-in 1.5s ease-out both}
.trs-band{transform-box:fill-box;transform-origin:50% 50%;animation:trs-band-grow 1.1s cubic-bezier(.16,1,.3,1) .4s both}
.trs-reach{stroke-dasharray:6 5;animation:trs-reach 1.6s linear both}
.trs-pulse{transform-box:fill-box;transform-origin:50% 50%;animation:trs-pulse 1.8s ease-in-out infinite}
.trs-label{animation:trs-fade-up .6s ease-out .5s both}

@media (prefers-reduced-motion: reduce){
  .trs-dot,.trs-line,.trs-miss,.trs-robot-line,.trs-band,.trs-reach,.trs-pulse,.trs-label{animation:none !important}
  .trs-miss{opacity:.85}
}
`;

/**
 * Eight measurements: rising, but deliberately NOT on a perfect line — they
 * zigzag either side of the fit by ~6px. The scatter has to be visible at
 * this size or beat 2 teaches nothing: the whole point is the gap between a
 * dot and your line, and dots that already sit on the line have no gap to
 * show.
 */
const DOTS: [number, number][] = [
  [24, 83],
  [42, 95],
  [60, 68],
  [78, 80],
  [96, 53],
  [114, 65],
  [132, 38],
  [150, 50],
];

/** The fitted line, as drawn across the plotted range. */
const FIT = { x1: 18, y1: 95, x2: 156, y2: 38 };

/** Where the same line lands out past the data, at the prediction mark. */
const PREDICT_X = 214;
const PREDICT_Y = 14;

function Axes() {
  return (
    <g>
      <line x1="14" y1="104" x2="240" y2="104" className="stroke-border-token" strokeWidth="1.5" />
      <line x1="14" y1="10" x2="14" y2="104" className="stroke-border-token" strokeWidth="1.5" />
    </g>
  );
}

function Dots({ animate = true }: { animate?: boolean }) {
  return (
    <g>
      {DOTS.map(([x, y], index) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="3.5"
          className={animate ? "trs-dot fill-brand" : "fill-brand"}
          style={animate ? { animationDelay: `${index * 90}ms` } : undefined}
        />
      ))}
    </g>
  );
}

/** Where the fitted line sits at a given x — used to draw the gaps. */
function fitYAt(x: number): number {
  const t = (x - FIT.x1) / (FIT.x2 - FIT.x1);
  return FIT.y1 + t * (FIT.y2 - FIT.y1);
}

export function TrendScene({ step }: { step: number }) {
  return (
    <div className="grid min-h-40 place-items-center overflow-hidden rounded-xl bg-surface p-3">
      <style>{SCENE_CSS}</style>
      <svg viewBox="0 0 250 118" className="h-auto w-full" style={{ direction: "ltr" }} aria-hidden="true">
        <Axes />

        {/* 1 — real measurements, and they are messy. */}
        {step === 1 ? <Dots /> : null}

        {/* 2 — your line goes through the middle; the gaps are the "miss". */}
        {step === 2 ? (
          <>
            <g>
              {DOTS.map(([x, y]) => {
                const lineY = fitYAt(x);
                return (
                  <line
                    key={`miss-${x}`}
                    x1={x}
                    y1={Math.min(y, lineY)}
                    x2={x}
                    y2={Math.max(y, lineY)}
                    className="trs-miss stroke-danger"
                    strokeWidth="2.5"
                    strokeDasharray="3 3"
                  />
                );
              })}
            </g>
            <line
              x1={FIT.x1}
              y1={FIT.y1}
              x2={FIT.x2}
              y2={FIT.y2}
              className="trs-line stroke-brand-strong"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <Dots animate={false} />
          </>
        ) : null}

        {/* 3 — the computer's line: the smallest miss there is. */}
        {step === 3 ? (
          <>
            <Dots animate={false} />
            <line
              x1={FIT.x1}
              y1={FIT.y1 + 6}
              x2={FIT.x2}
              y2={FIT.y2 + 6}
              className="stroke-brand-strong/40"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1={FIT.x1}
              y1={FIT.y1}
              x2={FIT.x2}
              y2={FIT.y2}
              className="trs-robot-line stroke-warning"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <text x="168" y="52" className="trs-label fill-warning text-[11px] font-bold">
              🤖
            </text>
          </>
        ) : null}

        {/* 4 — past the last dot, the honest answer is a range. */}
        {step === 4 ? (
          <>
            <Dots animate={false} />
            <line
              x1={FIT.x1}
              y1={FIT.y1}
              x2={FIT.x2}
              y2={FIT.y2}
              className="stroke-brand-strong"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* the line reaching out past every real measurement */}
            <line
              x1={FIT.x2}
              y1={FIT.y2}
              x2={PREDICT_X}
              y2={PREDICT_Y}
              className="trs-reach stroke-brand-strong/70"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* the band: wider the further out it goes */}
            <rect
              x={PREDICT_X - 16}
              y={PREDICT_Y - 16}
              width="32"
              height="34"
              rx="4"
              className="trs-band fill-info/25 stroke-info/50"
              strokeWidth="1.5"
            />
            <circle cx={PREDICT_X} cy={PREDICT_Y + 1} r="3.5" className="trs-pulse fill-info" />
            <text x={PREDICT_X} y={PREDICT_Y + 34} textAnchor="middle" className="trs-label fill-ink-muted text-[10px] font-bold">
              ?
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}
