import type { Point } from "./types";

/**
 * Ordinary least squares (normal equations) for y = slope*x + intercept.
 * "Fortune Teller"'s honesty rests on this being the SAME function the
 * "computer's turn" animation and the server grader both call.
 */
export interface FitLine {
  slope: number;
  intercept: number;
}

const DEGENERATE_EPSILON = 1e-9;

export function leastSquares(points: readonly Point[]): FitLine {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: points[0]!.y };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < DEGENERATE_EPSILON) {
    // Every point shares the same x — no meaningful slope for y-vs-x; the
    // best constant predictor is the mean y (a flat line through it).
    return { slope: 0, intercept: sumY / n };
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}
