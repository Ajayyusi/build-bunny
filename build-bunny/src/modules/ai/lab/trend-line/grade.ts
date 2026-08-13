import type { ActivityGradeResult, ActivityVerdict } from "@/modules/activities/types";

import { leastSquares } from "../math/leastSquares";
import { sumSquaredError } from "../math/sumSquaredError";
import { invalidAnswerResult, round2 } from "../shared";
import { trendLineAnswerSchema, type TrendLineConfig } from "./types";

/** 3-star band: within 15% of the true optimum — genuinely close, not just passing. */
const STAR3_FACTOR = 1.15;
/** PARTIAL band: half again as forgiving as the pass line — rewards a real attempt. */
const PARTIAL_MULTIPLIER = 1.5;
/** Prediction error band width, in residual standard deviations either side of the fitted value. */
const BAND_MULTIPLIER = 1.5;

/**
 * "Fortune Teller" grading (g-contracts): recompute the child's SSE and the
 * true least-squares SSE from the SAME points, both with the SAME
 * sumSquaredError function the live "total miss" number uses. PASS within
 * toleranceFactor of the optimum, 3 stars within 1.15x. The prediction is
 * checked against an honest error band around the fitted line but — per
 * g-contracts — doesn't gate PASS/FAIL on its own; the line fit is the
 * assessed skill, the prediction is where the child sees what "honest
 * uncertainty" looks like.
 */
export function gradeTrendLine(config: TrendLineConfig, submission: unknown): ActivityGradeResult {
  const parsed = trendLineAnswerSchema.safeParse(submission);
  if (!parsed.success) return invalidAnswerResult();

  const line = parsed.data.line;
  const optimum = leastSquares(config.points);
  const optimumSSE = sumSquaredError(config.points, optimum);
  const childSSE = sumSquaredError(config.points, line);

  const passThreshold = optimumSSE * config.toleranceFactor;
  const partialThreshold = optimumSSE * config.toleranceFactor * PARTIAL_MULTIPLIER;
  const starThreshold = optimumSSE * STAR3_FACTOR;

  let verdict: ActivityVerdict;
  if (childSSE <= passThreshold) verdict = "PASS";
  else if (childSSE <= partialThreshold) verdict = "PARTIAL";
  else verdict = "FAIL";

  const qualityPassed = childSSE <= starThreshold;

  const n = config.points.length;
  const residualStd = Math.sqrt(optimumSSE / n);
  const fittedPrediction = optimum.slope * config.predictAt + optimum.intercept;
  const bandLow = fittedPrediction - BAND_MULTIPLIER * residualStd;
  const bandHigh = fittedPrediction + BAND_MULTIPLIER * residualStd;
  const predictionInBand = parsed.data.prediction >= bandLow && parsed.data.prediction <= bandHigh;

  const primaryFeedback =
    verdict === "PASS"
      ? null
      : {
          code: "trendMissTooHigh",
          data: { childScore: round2(childSSE), targetScore: round2(passThreshold) },
        };

  return {
    verdict,
    qualityPassed,
    primaryFeedback,
    generatedCode: "",
    blockCount: null,
    summary: {
      childSSE: round2(childSSE),
      optimumSSE: round2(optimumSSE),
      line,
      optimum,
      prediction: parsed.data.prediction,
      fittedPrediction: round2(fittedPrediction),
      band: { low: round2(bandLow), high: round2(bandHigh) },
      predictionInBand,
    },
  };
}

/** Points and predictAt ARE the exercise — nothing here is an answer key to strip. */
export function stripTrendLineConfig(config: TrendLineConfig): TrendLineConfig {
  return config;
}
