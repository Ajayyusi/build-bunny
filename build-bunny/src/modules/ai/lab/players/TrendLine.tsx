"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/ui";

import { leastSquares } from "../math/leastSquares";
import { sumSquaredError } from "../math/sumSquaredError";
import type { TrendLineConfig, TrendLineWork } from "../trend-line/types";
import { resolveLocalized } from "./format";
import type { AiSimWidgetPlayerProps } from "./registry";
import { restoreLine } from "./restore-work";
import { useStableCallback } from "./useStableCallback";
import styles from "./widgets.module.css";

/**
 * "Fortune Teller" (phase G, client half): drag a trend line, watch the
 * "total miss" (sumSquaredError) fall, then let least squares (leastSquares)
 * show the true optimum — the SAME functions the server grader recomputes.
 * The prediction step's error band is derived from that real optimum too
 * (matching gradeTrendLine's band formula exactly), never from the child's
 * own line, so what they're shown is honest uncertainty, not a hint.
 */

const VIEW_W = 600;
const VIEW_H = 400;
const MARGIN = { top: 20, right: 24, bottom: 40, left: 52 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;
const BAND_MULTIPLIER = 1.5; // must match trend-line/grade.ts exactly

/**
 * Radius of the invisible circle that actually catches the drag, in viewBox
 * units. The visible dots are deliberately small, so this is the only thing
 * keeping the line draggable by finger.
 *
 * 23 rather than the 22 that would be exactly 44 units: the chart's own border
 * takes a pixel off each side of the content box, so units render at ~0.997 of
 * a CSS pixel and 22 lands just under the 44px minimum.
 */
const HIT_R = 23;

interface Domain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function dataToScreenX(x: number, domain: Domain): number {
  return MARGIN.left + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * PLOT_W;
}
function dataToScreenY(y: number, domain: Domain): number {
  return MARGIN.top + (1 - (y - domain.yMin) / (domain.yMax - domain.yMin)) * PLOT_H;
}
function screenToDataY(screenY: number, domain: Domain): number {
  const t = (screenY - MARGIN.top) / PLOT_H;
  return domain.yMin + (domain.yMax - domain.yMin) * (1 - t);
}

/**
 * Evenly spaced axis values, rounded to something a child would say out loud.
 *
 * The chart shipped with axis TITLES but no numbers, while the prediction
 * control asks for a number ("28.5"). Reading a value off a scale that has
 * no scale is not a hard puzzle, it is an impossible one — this is what the
 * axes were missing.
 */
function axisTicks(min: number, max: number, count = 4): number[] {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return [min];
  const step = span / count;
  // One decimal only when the range is small enough to need it.
  const round = (v: number) => (span >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i += 1) ticks.push(round(min + step * i));
  return [...new Set(ticks)];
}
function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function yAt(line: { slope: number; intercept: number }, x: number): number {
  return line.slope * x + line.intercept;
}
/** One decimal place, plain JS formatting — always Western digits regardless of locale. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

const INTERCEPT_STEP_FRACTION = 1 / 40;
const SLOPE_STEP_FRACTION = 1 / 20;

export function TrendLine({
  config: rawConfig,
  locale,
  disabled,
  reducedMotion,
  onWorkChange,
  initialWork,
}: AiSimWidgetPlayerProps) {
  const config = rawConfig as TrendLineConfig;
  const t = useTranslations("student.play.aiSim.trendLine");

  const svgRef = useRef<SVGSVGElement>(null);
  const reportWork = useStableCallback(onWorkChange);

  const optimum = useMemo(() => leastSquares(config.points), [config.points]);
  const optimumSSE = useMemo(
    () => sumSquaredError(config.points, optimum),
    [config.points, optimum],
  );
  const residualStd = useMemo(
    () => Math.sqrt(optimumSSE / config.points.length),
    [optimumSSE, config.points.length],
  );
  const fittedPrediction = useMemo(
    () => yAt(optimum, config.predictAt),
    [optimum, config.predictAt],
  );
  const bandLow = fittedPrediction - BAND_MULTIPLIER * residualStd;
  const bandHigh = fittedPrediction + BAND_MULTIPLIER * residualStd;

  const domain = useMemo<Domain>(() => {
    const xs = config.points.map((p) => p.x).concat(config.predictAt);
    const ys = config.points.map((p) => p.y).concat(bandLow, bandHigh);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const xPad = Math.max((x1 - x0) * 0.15, 1);
    const yPad = Math.max((y1 - y0) * 0.15, 1);
    return { xMin: x0 - xPad, xMax: x1 + xPad, yMin: y0 - yPad, yMax: y1 + yPad };
  }, [config.points, config.predictAt, bandLow, bandHigh]);

  const initialIntercept = useMemo(
    () => config.points.reduce((sum, p) => sum + p.y, 0) / config.points.length,
    [config.points],
  );
  // Restore the dragged line if one was autosaved. Only the line: subPhase
  // stays at "fit" on purpose, so a resuming child re-confirms their line
  // before predicting rather than being dropped past a step they may not
  // remember finishing.
  const [line, setLine] = useState<{ slope: number; intercept: number }>(
    () => restoreLine(initialWork) ?? { slope: 0, intercept: initialIntercept },
  );
  const [computerRevealed, setComputerRevealed] = useState(false);
  const [subPhase, setSubPhase] = useState<"fit" | "predict">("fit");
  const [prediction, setPrediction] = useState<number | null>(null);

  const childSSE = useMemo(() => sumSquaredError(config.points, line), [config.points, line]);

  const currentPrediction = prediction ?? yAt(line, config.predictAt);

  useEffect(() => {
    const work: TrendLineWork = { line, prediction: currentPrediction };
    reportWork(work, subPhase === "predict");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, currentPrediction, subPhase]);

  const dragHandle = (which: "left" | "right" | "center") => ({
    onPointerDown: (event: React.PointerEvent<SVGGElement>) => {
      if (disabled || subPhase !== "fit") return;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<SVGGElement>) => {
      if (disabled || subPhase !== "fit" || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const svg = svgRef.current;
      if (!svg) return;
      const pt = clientToSvgPoint(svg, event.clientX, event.clientY);
      const dataY = clamp(screenToDataY(pt.y, domain), domain.yMin, domain.yMax);
      if (which === "center") {
        const centerX = (domain.xMin + domain.xMax) / 2;
        const oldCenterY = yAt(line, centerX);
        setLine({ slope: line.slope, intercept: line.intercept + (dataY - oldCenterY) });
      } else if (which === "left") {
        const rightY = yAt(line, domain.xMax);
        const slope = (rightY - dataY) / (domain.xMax - domain.xMin);
        setLine({ slope, intercept: dataY - slope * domain.xMin });
      } else {
        const leftY = yAt(line, domain.xMin);
        const slope = (dataY - leftY) / (domain.xMax - domain.xMin);
        setLine({ slope, intercept: leftY - slope * domain.xMin });
      }
    },
    onPointerUp: (event: React.PointerEvent<SVGGElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
  });

  const handleKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
    if (disabled || subPhase !== "fit") return;
    const interceptStep = (domain.yMax - domain.yMin) * INTERCEPT_STEP_FRACTION;
    const slopeStep =
      ((domain.yMax - domain.yMin) / (domain.xMax - domain.xMin)) * SLOPE_STEP_FRACTION;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const sign = event.key === "ArrowUp" ? 1 : -1;
      if (event.shiftKey) {
        setLine({ slope: line.slope + sign * slopeStep, intercept: line.intercept });
      } else {
        setLine({ slope: line.slope, intercept: line.intercept + sign * interceptStep });
      }
    }
  };

  const goToPredict = () => {
    if (!computerRevealed) return;
    setPrediction((current) => current ?? yAt(line, config.predictAt));
    setSubPhase("predict");
  };

  const childX1 = dataToScreenX(domain.xMin, domain);
  const childY1 = dataToScreenY(yAt(line, domain.xMin), domain);
  const childX2 = dataToScreenX(domain.xMax, domain);
  const childY2 = dataToScreenY(yAt(line, domain.xMax), domain);

  const optimumX1 = dataToScreenX(domain.xMin, domain);
  const optimumY1 = dataToScreenY(yAt(optimum, domain.xMin), domain);
  const optimumX2 = dataToScreenX(domain.xMax, domain);
  const optimumY2 = dataToScreenY(yAt(optimum, domain.xMax), domain);

  const xAxisText = resolveLocalized(config.xAxis, locale);
  const yAxisText = resolveLocalized(config.yAxis, locale);

  const predictAtX = dataToScreenX(config.predictAt, domain);
  const bandTopY = dataToScreenY(bandHigh, domain);
  const bandBottomY = dataToScreenY(bandLow, domain);
  const predictionY = dataToScreenY(currentPrediction, domain);
  const inBand = subPhase === "predict" && currentPrediction >= bandLow && currentPrediction <= bandHigh;

  const tickXMin = Math.min(...config.points.map((p) => p.x));
  const tickXMax = Math.max(...config.points.map((p) => p.x), config.predictAt);

  const sliderMin = domain.yMin;
  const sliderMax = domain.yMax;
  const sliderStep = Math.max((sliderMax - sliderMin) / 200, 0.01);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-ink-muted">
        {subPhase === "fit" ? t("instructionsFit") : t("instructionsPredict")}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-ink">
        <span
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 tabular-nums"
        >
          {t("totalMiss", { score: round1(childSSE) })}
        </span>
        {computerRevealed ? (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-warning/14 px-3 py-1 text-warning tabular-nums", !reducedMotion && styles.popIn)}>
            {t("computerMiss", { score: round1(optimumSSE) })}
          </span>
        ) : null}
        {/* The scores are meaningless without knowing which way is good. */}
        <span className="text-xs font-normal text-ink-muted">{t("lowerIsBetter")}</span>
      </div>

      {/* Which line is whose. Two lines were on screen with nothing naming
          them; the dash pattern carries the difference as well as the colour
          so it does not rely on colour alone. */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <svg aria-hidden="true" viewBox="0 0 28 8" className="h-2 w-7">
            <line x1="0" y1="4" x2="28" y2="4" className="stroke-brand-strong" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {t("legendYours")}
        </span>
        {computerRevealed ? (
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden="true" viewBox="0 0 28 8" className="h-2 w-7">
              <line x1="0" y1="4" x2="28" y2="4" className="stroke-warning" strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" />
            </svg>
            {t("legendComputer")}
          </span>
        ) : null}
        {/* The shaded band is the whole lesson — "predictions come with a
            range, not a number" — and it was on screen unnamed. */}
        {subPhase === "predict" ? (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-7 rounded-sm bg-info/25 ring-1 ring-info/40"
            />
            {t("legendBand")}
          </span>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ direction: "ltr" }}
        role="img"
        aria-label={t("chartLabel")}
        className="h-auto w-full max-w-[600px] touch-none select-none rounded-lg border border-border-token bg-surface-raised"
      >
        <line x1={MARGIN.left} y1={MARGIN.top + PLOT_H} x2={MARGIN.left + PLOT_W} y2={MARGIN.top + PLOT_H} className="stroke-border-token" strokeWidth={1.5} />
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + PLOT_H} className="stroke-border-token" strokeWidth={1.5} />
        <text x={MARGIN.left + PLOT_W / 2} y={VIEW_H - 8} textAnchor="middle" className="fill-ink-muted text-[13px] font-semibold">
          {xAxisText}
        </text>
        <text x={14} y={MARGIN.top + PLOT_H / 2} textAnchor="middle" transform={`rotate(-90 14 ${MARGIN.top + PLOT_H / 2})`} className="fill-ink-muted text-[13px] font-semibold">
          {yAxisText}
        </text>

        {/* Numbers on the axes. Without these the prediction slider asks a
            child to name a height on a chart that shows no heights. */}
        <g aria-hidden="true">
          {axisTicks(domain.yMin, domain.yMax).map((value) => {
            const y = dataToScreenY(value, domain);
            return (
              <g key={`y-${value}`}>
                <line
                  x1={MARGIN.left - 4}
                  y1={y}
                  x2={MARGIN.left}
                  y2={y}
                  className="stroke-border-token"
                  strokeWidth={1.5}
                />
                <text
                  x={MARGIN.left - 7}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-ink-muted text-[11px] tabular-nums"
                >
                  {value}
                </text>
              </g>
            );
          })}
          {/* Ticks span the real data, not the padded drawing domain: the
              padding exists to keep dots off the frame, and labelling it
              produced "-1 hours of sunlight". */}
          {axisTicks(tickXMin, tickXMax).map((value) => {
            const x = dataToScreenX(value, domain);
            return (
              <g key={`x-${value}`}>
                <line
                  x1={x}
                  y1={MARGIN.top + PLOT_H}
                  x2={x}
                  y2={MARGIN.top + PLOT_H + 4}
                  className="stroke-border-token"
                  strokeWidth={1.5}
                />
                <text
                  x={x}
                  y={MARGIN.top + PLOT_H + 16}
                  textAnchor="middle"
                  className="fill-ink-muted text-[11px] tabular-nums"
                >
                  {value}
                </text>
              </g>
            );
          })}
        </g>

        {/* Prediction guide + honest error band (predict phase only) */}
        {subPhase === "predict" ? (
          <g aria-hidden="true">
            <rect
              x={predictAtX - 26}
              y={bandTopY}
              width={52}
              height={Math.max(bandBottomY - bandTopY, 1)}
              className={cn("fill-info/15", !reducedMotion && styles.gridFadeIn)}
            />
            <line x1={predictAtX} y1={MARGIN.top} x2={predictAtX} y2={MARGIN.top + PLOT_H} className="stroke-info" strokeWidth={1.5} strokeDasharray="4 4" />
          </g>
        ) : null}

        {/* Miss whiskers — live vertical residuals from each point to the child's line. */}
        {subPhase === "fit" ? (
          <g aria-hidden="true">
            {config.points.map((point, index) => {
              const px = dataToScreenX(point.x, domain);
              const py = dataToScreenY(point.y, domain);
              const ly = dataToScreenY(yAt(line, point.x), domain);
              return (
                <line
                  key={index}
                  x1={px}
                  y1={py}
                  x2={px}
                  y2={ly}
                  stroke="var(--color-danger)"
                  strokeOpacity={0.55}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              );
            })}
          </g>
        ) : null}

        {/* Points */}
        <g aria-hidden="true">
          {config.points.map((point, index) => (
            <circle key={index} cx={dataToScreenX(point.x, domain)} cy={dataToScreenY(point.y, domain)} r={6} className="fill-brand stroke-surface-raised" strokeWidth={1.5} />
          ))}
        </g>

        {/* Least-squares comparison line */}
        {computerRevealed ? (
          <line x1={optimumX1} y1={optimumY1} x2={optimumX2} y2={optimumY2} className={cn("stroke-warning", !reducedMotion && styles.lineReveal)} strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" />
        ) : null}

        {/* Child's line */}
        <line x1={childX1} y1={childY1} x2={childX2} y2={childY2} className="stroke-brand-strong" strokeWidth={3} opacity={subPhase === "predict" ? 0.55 : 1} />

        {subPhase === "fit" && !disabled ? (
          <>
            <g {...dragHandle("center")} tabIndex={0} role="button" aria-label={t("dragHandleLabel")} aria-describedby="trend-line-help" onKeyDown={handleKeyDown} className={cn(styles.handle, "cursor-grab focus:outline-none")}>
              <circle cx={(childX1 + childX2) / 2} cy={(childY1 + childY2) / 2} r={HIT_R} fill="transparent" />
              <circle cx={(childX1 + childX2) / 2} cy={(childY1 + childY2) / 2} r={10} className="fill-brand-strong stroke-surface-raised" strokeWidth={2} />
            </g>
            <g {...dragHandle("left")} className={cn(styles.handle, "cursor-ns-resize")}>
              <circle cx={childX1} cy={childY1} r={HIT_R} fill="transparent" />
              <circle cx={childX1} cy={childY1} r={7} className="fill-surface-raised stroke-brand-strong" strokeWidth={2.5} />
            </g>
            <g {...dragHandle("right")} className={cn(styles.handle, "cursor-ns-resize")}>
              <circle cx={childX2} cy={childY2} r={HIT_R} fill="transparent" />
              <circle cx={childX2} cy={childY2} r={7} className="fill-surface-raised stroke-brand-strong" strokeWidth={2.5} />
            </g>
          </>
        ) : null}

        {/* Prediction marker */}
        {subPhase === "predict" ? (
          <circle cx={predictAtX} cy={predictionY} r={9} className="fill-info stroke-surface-raised" strokeWidth={2} />
        ) : null}
      </svg>
      <p id="trend-line-help" className="sr-only">
        {t("dragHandleHelp")}
      </p>

      {subPhase === "fit" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setComputerRevealed(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-border-token bg-surface-raised px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-60"
          >
            <span aria-hidden="true">🤖</span>
            {t("computerTurn")}
          </button>
          {computerRevealed ? (
            <button
              type="button"
              disabled={disabled}
              onClick={goToPredict}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:pointer-events-none disabled:opacity-60"
            >
              {t("continueToPredict")}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-border-token bg-surface-raised p-4">
          <label htmlFor="trend-line-prediction" className="text-sm font-semibold text-ink">
            {t("predictionLabel", { x: config.predictAt })}
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={disabled}
              aria-label={t("predictionDecrease")}
              onClick={() => setPrediction(clamp(currentPrediction - sliderStep * 10, sliderMin, sliderMax))}
              className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-border-token text-lg font-bold text-ink transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-60"
            >
              −
            </button>
            <input
              id="trend-line-prediction"
              type="range"
              disabled={disabled}
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={currentPrediction}
              onChange={(event) => setPrediction(Number(event.target.value))}
              className="h-11 flex-1 accent-brand"
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={t("predictionIncrease")}
              onClick={() => setPrediction(clamp(currentPrediction + sliderStep * 10, sliderMin, sliderMax))}
              className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-border-token text-lg font-bold text-ink transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-60"
            >
              +
            </button>
          </div>
          <p aria-live="polite" className="text-sm text-ink-muted">
            {t("predictionValue", { value: round1(currentPrediction) })}
            {" — "}
            {inBand ? t("bandInsideNote") : t("bandOutsideNote")}
          </p>
        </div>
      )}
    </div>
  );
}
