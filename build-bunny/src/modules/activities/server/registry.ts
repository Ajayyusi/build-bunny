import "server-only";

import type { V1ActivityType } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { stripStudentPayload } from "@/modules/curriculum/server/queries";

import type { ActivityGradeResult } from "../types";
import {
  codePredictionAnswerSchema,
  gradeCodePrediction,
} from "./code-prediction";
import { conceptCardsAnswerSchema, gradeConceptCards } from "./concept-cards";
import { gradeGridActivity } from "./grid";
import { gradeSequencing, sequencingAnswerSchema } from "./sequencing";

/**
 * The activity-engine registry (m4 task 4), server half: keyed by
 * ActivityType, exposing the grader + the student-payload stripper. The
 * client half (lazy player components) lives in
 * src/modules/activities/players/registry.tsx — split across the two files
 * because a "use client" boundary is required for BLOCK_CODING/DEBUGGING's
 * ssr:false Blockly player, and Next.js forbids that inside code a Server
 * Component can reach without crossing one first.
 *
 * Registering a future type (QUIZ, PATTERN_RECOGNITION, AI_CLASSIFICATION,
 * REAL_ML, AI_ETHICS — already in the ActivityType enum, no V1 engine) is
 * adding one entry here + one in players/registry.tsx; nothing else in the
 * attempts pipeline changes.
 */

export interface ActivityEngine {
  /** Grades one submission against the level's published snapshot. */
  grade(snapshot: LevelSnapshot, input: unknown): ActivityGradeResult;
  /** Removes answer-bearing fields before a payload reaches a student client. */
  stripPayload(payload: unknown): unknown;
}

function invalidAnswer(): ActivityGradeResult {
  return {
    verdict: "ERROR",
    qualityPassed: false,
    primaryFeedback: { code: "runtimeError", data: { reason: "invalidAnswer" } },
    generatedCode: "",
    blockCount: null,
    summary: {},
  };
}

/** BLOCK_CODING and DEBUGGING share one engine — same grading pipeline. */
const grid: ActivityEngine = {
  grade: (snapshot, input) => gradeGridActivity(snapshot, input),
  stripPayload: (payload) => stripStudentPayload("BLOCK_CODING", payload),
};

const codePrediction: ActivityEngine = {
  grade: (snapshot, input) => {
    // Belt-and-suspenders: the attempts route already validates the body
    // shape against the level's activityType before this is ever reached.
    const parsed = codePredictionAnswerSchema.safeParse(input);
    return parsed.success ? gradeCodePrediction(snapshot, parsed.data) : invalidAnswer();
  },
  stripPayload: (payload) => stripStudentPayload("CODE_PREDICTION", payload),
};

const sequencing: ActivityEngine = {
  grade: (snapshot, input) => {
    const parsed = sequencingAnswerSchema.safeParse(input);
    return parsed.success ? gradeSequencing(snapshot, parsed.data) : invalidAnswer();
  },
  stripPayload: (payload) => stripStudentPayload("SEQUENCING", payload),
};

/** The Learn step (LEARN-STEP-SPEC.md) — teaches a concept, grades on completion. */
const conceptCards: ActivityEngine = {
  grade: (snapshot, input) => {
    const parsed = conceptCardsAnswerSchema.safeParse(input);
    return parsed.success ? gradeConceptCards(snapshot, parsed.data) : invalidAnswer();
  },
  stripPayload: (payload) => stripStudentPayload("CONCEPT_CARDS", payload),
};

export const ACTIVITY_ENGINES: Partial<Record<V1ActivityType, ActivityEngine>> = {
  BLOCK_CODING: grid,
  DEBUGGING: grid,
  CODE_PREDICTION: codePrediction,
  SEQUENCING: sequencing,
  CONCEPT_CARDS: conceptCards,
};

export function getActivityEngine(activityType: string): ActivityEngine | undefined {
  return ACTIVITY_ENGINES[activityType as V1ActivityType];
}
