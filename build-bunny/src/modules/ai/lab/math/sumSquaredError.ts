import type { Point } from "./types";
import type { FitLine } from "./leastSquares";

/**
 * "Total miss" — the sum of squared vertical distances from each point to a
 * line. Shown to the child as a plain live number (the miss score) and used
 * server-side to compare a submission against the least-squares optimum.
 */
export function sumSquaredError(points: readonly Point[], line: FitLine): number {
  let sum = 0;
  for (const p of points) {
    const predicted = line.slope * p.x + line.intercept;
    const residual = p.y - predicted;
    sum += residual * residual;
  }
  return sum;
}
