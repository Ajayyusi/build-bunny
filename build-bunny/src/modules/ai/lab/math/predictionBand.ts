import { leastSquares } from "./leastSquares";
import { sumSquaredError } from "./sumSquaredError";
import type { Point } from "./types";

/** Band half-width, in residual spreads, at the middle of the data. */
export const PREDICTION_BAND_SPREAD = 1.5;

export interface PredictionBand {
  /** The best-fit line's value at x. */
  fitted: number;
  low: number;
  high: number;
  halfWidth: number;
  /** x lies outside the measured range. */
  beyondData: boolean;
}

/**
 * The honest "likely range" around a prediction at x. It is a real
 * prediction interval's shape: the residual spread s = √(SSE/n) of the
 * best-fit line, widened by √(1 + 1/n + (x − x̄)² / Sxx) — so it is
 * narrowest in the middle of the data and grows the further x sits from
 * it. (It used to be one fixed width everywhere, while the lesson told the
 * child it widens beyond the data.) Shared by the widget and the grader.
 */
export function predictionBand(points: readonly Point[], x: number): PredictionBand {
  const n = points.length;
  const line = leastSquares(points);
  const fitted = line.slope * x + line.intercept;
  if (n === 0) return { fitted, low: fitted, high: fitted, halfWidth: 0, beyondData: true };
  const spread = Math.sqrt(sumSquaredError(points, line) / n);
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const sxx = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  const widen = Math.sqrt(1 + 1 / n + (sxx > 0 ? (x - meanX) ** 2 / sxx : 0));
  const halfWidth = PREDICTION_BAND_SPREAD * spread * widen;
  const xs = points.map((p) => p.x);
  return {
    fitted,
    low: fitted - halfWidth,
    high: fitted + halfWidth,
    halfWidth,
    beyondData: x < Math.min(...xs) || x > Math.max(...xs),
  };
}

/** The middle of the measured x values — where the band is narrowest. */
export function dataMiddleX(points: readonly Point[]): number {
  return points.length === 0 ? 0 : points.reduce((sum, p) => sum + p.x, 0) / points.length;
}
