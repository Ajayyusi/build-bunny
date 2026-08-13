import type { ActivityGradeResult } from "@/modules/activities/types";

/**
 * Small pieces every AI_SIM widget's grade() shares — kept here instead of
 * duplicated three times. Not "server-only": registry.ts (the only server
 * caller) already carries that pragma, and nothing here touches the DB.
 */

/** A submission that failed its own answer schema — malformed client, not a wrong answer. */
export function invalidAnswerResult(): ActivityGradeResult {
  return {
    verdict: "ERROR",
    qualityPassed: false,
    primaryFeedback: { code: "runtimeError", data: { reason: "invalidAnswer" } },
    generatedCode: "",
    blockCount: null,
    summary: {},
  };
}

/** Round to 2dp for feedback/summary numbers — plenty of precision for a miss score a child reads. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
