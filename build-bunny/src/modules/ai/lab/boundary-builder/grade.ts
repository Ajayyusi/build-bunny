import type { ActivityGradeResult, ActivityVerdict } from "@/modules/activities/types";

import { countMisclassified } from "../math/classify";
import type { Line } from "../math/types";
import { invalidAnswerResult } from "../shared";
import { boundaryBuilderAnswerSchema, labelIdsOf, type BoundaryBuilderConfig } from "./types";

/**
 * "You Be the Classifier" grading (g-contracts): recompute misclassifications
 * for the SUBMITTED line — never trust a client-reported count. PASS at
 * <= maxErrors, 3 stars at 0, FAIL otherwise — with `close` set in the
 * feedback when the line is within the old "still learning" cushion.
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

  // No PARTIAL band: submit.ts completes a level on PARTIAL, so a line with
  // four fruit on the wrong side used to finish the level (1 star). The
  // cushion now only tells the child they are close.
  const verdict: ActivityVerdict = errors <= passLimit ? "PASS" : "FAIL";
  const close = errors > passLimit && errors <= partialLimit;

  const qualityPassed = errors === 0;
  const primaryFeedback =
    verdict === "PASS"
      ? null
      : { code: "classifierErrors", data: { errors, maxErrors: passLimit, close } };

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
