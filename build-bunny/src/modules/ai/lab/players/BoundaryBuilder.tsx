"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/ui";

import { centroidRule } from "../math/centroidRule";
import { countMisclassified } from "../math/classify";
import type { Line } from "../math/types";
import type { BoundaryBuilderConfig, BoundaryBuilderWork } from "../boundary-builder/types";
import { resolveLocalized } from "./format";
import type { AiSimWidgetPlayerProps } from "./registry";
import { useStableCallback } from "./useStableCallback";
import styles from "./widgets.module.css";

/**
 * "You Be the Classifier" (phase G, client half): an SVG scatter with a
 * draggable dividing line. Uses ONLY the shared pure math (countMisclassified,
 * centroidRule) — the live count a child watches IS the function the server
 * re-runs on submission, so they can never disagree.
 *
 * Coordinate system: `domain` maps the config's data-space points into a
 * fixed 600x400 SVG viewBox (`dataToScreen*`/`screenToData*`); the child's
 * own line is always a genuine {slope,intercept} because the two endpoint
 * handles sit at the domain's distinct xMin/xMax — an "infinite slope"
 * vertical line is structurally impossible to drag into.
 */

const VIEW_W = 600;
const VIEW_H = 400;
const MARGIN = { top: 20, right: 24, bottom: 40, left: 52 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;

interface Domain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function computeDomain(points: readonly { x: number; y: number }[]): Domain {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const xPad = Math.max((x1 - x0) * 0.15, 1);
  const yPad = Math.max((y1 - y0) * 0.15, 1);
  return { xMin: x0 - xPad, xMax: x1 + xPad, yMin: y0 - yPad, yMax: y1 + yPad };
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

/** DOM client coords → SVG user-space coords, independent of CSS scaling. */
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

/** Screen-space endpoints for a Line clipped to the plot rectangle (handles the vertical case). */
function lineSegment(line: Line, domain: Domain): { x1: number; y1: number; x2: number; y2: number } {
  if ("vertical" in line) {
    const x = dataToScreenX(line.x, domain);
    return { x1: x, y1: MARGIN.top, x2: x, y2: MARGIN.top + PLOT_H };
  }
  return {
    x1: dataToScreenX(domain.xMin, domain),
    y1: dataToScreenY(yAt(line, domain.xMin), domain),
    x2: dataToScreenX(domain.xMax, domain),
    y2: dataToScreenY(yAt(line, domain.xMax), domain),
  };
}

const INTERCEPT_STEP_FRACTION = 1 / 40;
const SLOPE_STEP_FRACTION = 1 / 20;

export function BoundaryBuilder({ config: rawConfig, locale, disabled, reducedMotion, onWorkChange }: AiSimWidgetPlayerProps) {
  const config = rawConfig as BoundaryBuilderConfig;
  const t = useTranslations("student.play.aiSim.boundaryBuilder");

  const svgRef = useRef<SVGSVGElement>(null);
  const reportWork = useStableCallback(onWorkChange);

  const domain = useMemo(() => computeDomain(config.points), [config.points]);
  const labelIds = useMemo<[string, string]>(
    () => [config.labels[0]!.id, config.labels[1]!.id],
    [config.labels],
  );

  const initialIntercept = useMemo(
    () => config.points.reduce((sum, p) => sum + p.y, 0) / config.points.length,
    [config.points],
  );
  const [line, setLine] = useState<{ slope: number; intercept: number }>({
    slope: 0,
    intercept: initialIntercept,
  });
  const [computerRevealed, setComputerRevealed] = useState(false);

  const { errors, misclassifiedIds } = useMemo(
    () => countMisclassified(config.points, line, labelIds),
    [config.points, line, labelIds],
  );
  const misclassifiedSet = useMemo(() => new Set(misclassifiedIds), [misclassifiedIds]);

  const computer = useMemo(() => centroidRule(config.points, labelIds), [config.points, labelIds]);
  const computerErrors = useMemo(
    () => countMisclassified(config.points, computer.line, labelIds).errors,
    [config.points, computer.line, labelIds],
  );

  const commitLine = (next: { slope: number; intercept: number }) => {
    setLine(next);
    const work: BoundaryBuilderWork = { line: next };
    reportWork(work, true);
  };

  // Report the initial line once on mount so the wrapper has something to
  // submit even if the child never touches the control. A plain mount
  // effect (not a render-time call) — reportWork ultimately updates the
  // wrapper's state, which React forbids doing mid-render.
  useEffect(() => {
    reportWork({ line } satisfies BoundaryBuilderWork, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dragHandle = (which: "left" | "right" | "center") => ({
    onPointerDown: (event: React.PointerEvent<SVGGElement>) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<SVGGElement>) => {
      if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const svg = svgRef.current;
      if (!svg) return;
      const pt = clientToSvgPoint(svg, event.clientX, event.clientY);
      const dataY = clamp(screenToDataY(pt.y, domain), domain.yMin, domain.yMax);
      if (which === "center") {
        const centerX = (domain.xMin + domain.xMax) / 2;
        const oldCenterY = yAt(line, centerX);
        commitLine({ slope: line.slope, intercept: line.intercept + (dataY - oldCenterY) });
      } else if (which === "left") {
        const rightY = yAt(line, domain.xMax);
        const slope = (rightY - dataY) / (domain.xMax - domain.xMin);
        commitLine({ slope, intercept: dataY - slope * domain.xMin });
      } else {
        const leftY = yAt(line, domain.xMin);
        const slope = (dataY - leftY) / (domain.xMax - domain.xMin);
        commitLine({ slope, intercept: leftY - slope * domain.xMin });
      }
    },
    onPointerUp: (event: React.PointerEvent<SVGGElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
  });

  const handleKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
    if (disabled) return;
    const interceptStep = (domain.yMax - domain.yMin) * INTERCEPT_STEP_FRACTION;
    const slopeStep =
      ((domain.yMax - domain.yMin) / (domain.xMax - domain.xMin)) * SLOPE_STEP_FRACTION;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const sign = event.key === "ArrowUp" ? 1 : -1;
      if (event.shiftKey) {
        commitLine({ slope: line.slope + sign * slopeStep, intercept: line.intercept });
      } else {
        commitLine({ slope: line.slope, intercept: line.intercept + sign * interceptStep });
      }
    }
  };

  const childSegment = lineSegment(line, domain);
  const computerSegment = lineSegment(computer.line, domain);

  const labelA = config.labels[0]!;
  const labelB = config.labels[1]!;
  const xAxisText = resolveLocalized(config.xAxis, locale);
  const yAxisText = resolveLocalized(config.yAxis, locale);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-ink-muted">{t("instructions")}</p>

      {/* Legend — shape AND color, never color alone. */}
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-ink">
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="6" className="fill-brand" />
          </svg>
          {resolveLocalized(labelA.text, locale)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
            <rect x="1.5" y="1.5" width="11" height="11" className="fill-info" transform="rotate(45 7 7)" />
          </svg>
          {resolveLocalized(labelB.text, locale)}
        </span>
        <span
          aria-live="polite"
          className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 tabular-nums"
        >
          {errors === 0 ? t("misclassifiedZero") : t("misclassifiedCount", { count: errors })}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ direction: "ltr" }}
        role="img"
        aria-label={t("chartLabel")}
        className="h-auto w-full max-w-[600px] touch-none select-none rounded-lg border border-border-token bg-surface-raised"
      >
        {/* Axes */}
        <line
          x1={MARGIN.left}
          y1={MARGIN.top + PLOT_H}
          x2={MARGIN.left + PLOT_W}
          y2={MARGIN.top + PLOT_H}
          className="stroke-border-token"
          strokeWidth={1.5}
        />
        <line
          x1={MARGIN.left}
          y1={MARGIN.top}
          x2={MARGIN.left}
          y2={MARGIN.top + PLOT_H}
          className="stroke-border-token"
          strokeWidth={1.5}
        />
        <text
          x={MARGIN.left + PLOT_W / 2}
          y={VIEW_H - 8}
          textAnchor="middle"
          className="fill-ink-muted text-[13px] font-semibold"
        >
          {xAxisText}
        </text>
        <text
          x={14}
          y={MARGIN.top + PLOT_H / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${MARGIN.top + PLOT_H / 2})`}
          className="fill-ink-muted text-[13px] font-semibold"
        >
          {yAxisText}
        </text>

        {/* Computer's line (revealed on demand) */}
        {computerRevealed ? (
          <line
            x1={computerSegment.x1}
            y1={computerSegment.y1}
            x2={computerSegment.x2}
            y2={computerSegment.y2}
            className={cn("stroke-warning", !reducedMotion && styles.lineReveal)}
            strokeWidth={3}
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
        ) : null}

        {/* Points — decorative; the live count + keyboard control carry the a11y story. */}
        <g aria-hidden="true">
          {config.points.map((point) => {
            const isA = point.label === labelA.id;
            const cx = dataToScreenX(point.x, domain);
            const cy = dataToScreenY(point.y, domain);
            const wrong = misclassifiedSet.has(point.id);
            const markerClass = cn(
              wrong ? "stroke-danger" : "stroke-surface-raised",
              wrong && !reducedMotion && styles.wobble,
            );
            return (
              <g key={point.id} className={markerClass} strokeWidth={wrong ? 2.5 : 1.5}>
                {isA ? (
                  <circle cx={cx} cy={cy} r={7} className="fill-brand" />
                ) : (
                  <rect
                    x={cx - 6}
                    y={cy - 6}
                    width="12"
                    height="12"
                    className="fill-info"
                    transform={`rotate(45 ${cx} ${cy})`}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Child's dividing line */}
        <line
          x1={childSegment.x1}
          y1={childSegment.y1}
          x2={childSegment.x2}
          y2={childSegment.y2}
          className="stroke-brand-strong"
          strokeWidth={3}
        />

        {!disabled ? (
          <>
            <g
              {...dragHandle("center")}
              tabIndex={0}
              role="button"
              aria-label={t("dragHandleLabel")}
              aria-describedby="boundary-builder-help"
              onKeyDown={handleKeyDown}
              className={cn(styles.handle, "cursor-grab focus:outline-none")}
            >
              <circle
                cx={(childSegment.x1 + childSegment.x2) / 2}
                cy={(childSegment.y1 + childSegment.y2) / 2}
                r={22}
                fill="transparent"
              />
              <circle
                cx={(childSegment.x1 + childSegment.x2) / 2}
                cy={(childSegment.y1 + childSegment.y2) / 2}
                r={10}
                className="fill-brand-strong stroke-surface-raised"
                strokeWidth={2}
              />
            </g>
            <g {...dragHandle("left")} className={cn(styles.handle, "cursor-ns-resize")}>
              <circle cx={childSegment.x1} cy={childSegment.y1} r={20} fill="transparent" />
              <circle
                cx={childSegment.x1}
                cy={childSegment.y1}
                r={7}
                className="fill-surface-raised stroke-brand-strong"
                strokeWidth={2.5}
              />
            </g>
            <g {...dragHandle("right")} className={cn(styles.handle, "cursor-ns-resize")}>
              <circle cx={childSegment.x2} cy={childSegment.y2} r={20} fill="transparent" />
              <circle
                cx={childSegment.x2}
                cy={childSegment.y2}
                r={7}
                className="fill-surface-raised stroke-brand-strong"
                strokeWidth={2.5}
              />
            </g>
          </>
        ) : null}
      </svg>
      <p id="boundary-builder-help" className="sr-only">
        {t("dragHandleHelp")}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setComputerRevealed((v) => !v)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-border-token bg-surface-raised px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-60"
        >
          <span aria-hidden="true">🤖</span>
          {computerRevealed ? t("hideComputer") : t("letComputerTry")}
        </button>
        {computerRevealed ? (
          <p className={cn("text-sm font-semibold text-ink", !reducedMotion && styles.popIn)}>
            {t("comparison", { childErrors: errors, computerErrors })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
