import type { ActivityGradeResult, ActivityVerdict } from "@/modules/activities/types";

import { countMisclassified } from "../math/classify";
import type { Line } from "../math/types";
import { invalidAnswerResult } from "../shared";
import { boundaryBuilderAnswerSchema, labelIdsOf, type BoundaryBuilderConfig } from "./types";

/**
 * "You Be the Classifier" grading (g-contracts): recompute misclassifications
 * for the SUBMITTED line — never trust a client-reported count. PASS at
 * <= maxErrors, 3 stars at 0. A generous PARTIAL band rewards a genuine,
 * close attempt instead of dropping straight to FAIL.
 */
export function gradeBoundaryBuilder(
  config: BoundaryBuilderConfig,
  submission: unknown,
): ActivityGradeResult {
  const parsed = boundaryBuilderAnswerSchema.safeParse(submission);
  if (!parsed.success) return invalidAnswerResult();

  const line: Line = { slope: parsed.data.line.slope, intercept: parsed.data.line.intercept };
  const labelIds = labelIdsOf(config);
  const { errors, misclassifiedIds } = countMisclassified(config.points, line, labelIds);

  const total = config.points.length;
  const passLimit = config.maxErrors;
  // A "still learning" cushion above the pass line — at least one extra
  // point of slack even when maxErrors is 0, sized to a fifth of the set.
  const partialLimit = passLimit + Math.max(1, Math.ceil(total * 0.2));

  let verdict: ActivityVerdict;
  if (errors <= passLimit) verdict = "PASS";
  else if (errors <= partialLimit) verdict = "PARTIAL";
  else verdict = "FAIL";

  const qualityPassed = errors === 0;
  const primaryFeedback =
    verdict === "PASS"
      ? null
      : { code: "classifierErrors", data: { errors, maxErrors: passLimit } };

  return {
    verdict,
    qualityPassed,
    primaryFeedback,
    generatedCode: "",
    blockCount: null,
    summary: { errors, misclassifiedIds, line },
  };
}

/** Nothing in a boundary-builder config is answer-bearing: the points' true labels ARE the exercise. */
export function stripBoundaryBuilderConfig(config: BoundaryBuilderConfig): BoundaryBuilderConfig {
  return config;
}
