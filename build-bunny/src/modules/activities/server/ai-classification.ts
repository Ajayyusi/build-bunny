import "server-only";

import { z } from "zod";

import { classify, type LabelledSpecimen } from "@/modules/ai/knn";
import {
  aiClassificationPayload,
  type ClassificationRule,
} from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

import type { ActivityGradeResult } from "../types";

/**
 * AI_CLASSIFICATION engine — "Teach the Bunny".
 *
 * The student labels specimens; this fits a 1-nearest-neighbour classifier
 * to exactly those labels and scores it on the level's held-out test set.
 * 1-NN is chosen deliberately over anything cleverer: it is fully
 * explainable to a nine-year-old ("it picks the example that looks most
 * like the new one"), it needs no training loop, and it makes the effect of
 * a badly-chosen example immediate and visible rather than smoothed away.
 *
 * The grading question is NOT "did the student label correctly" — they can
 * see the berries, so that would be trivial. It is "do the examples they
 * chose let the model generalise to specimens it has never seen", which is
 * the actual machine-learning skill and cannot be brute-forced by labelling
 * everything correctly but unrepresentatively.
 */

const labelledSpecimen = z
  .object({
    id: z.string().min(1),
    size: z.number().min(0).max(1),
    color: z.number().min(0).max(1),
    label: z.enum(["positive", "negative"]),
  })
  .strict();

/**
 * THE wire shape for an AI_CLASSIFICATION submission — one schema, imported
 * by the attempts route, the grader and the tests.
 *
 * It used to exist as four hand-maintained copies (route, grader, the TS
 * union in submit.ts, and a mirror in the test file). That is not a
 * hypothetical hazard: the player once spread a whole pool specimen into a
 * submission, the `truth` field tripped the route's .strict(), and every
 * attempt 400'd — which the UI rendered as "not quite yet", telling children
 * to rethink work that never reached the grader.
 */
export const aiClassificationAnswerSchema = z
  .object({
    /** Every specimen the student put in a bucket. */
    examples: z.array(labelledSpecimen).min(1).max(64),
    /**
     * Pool ids the student set aside as their OWN test pile (levels with a
     * `holdout` block). Never trained on; the grader enforces the split.
     */
    checkSet: z.array(z.string().min(1)).max(64).optional(),
  })
  .strict();
export type AiClassificationAnswer = z.infer<typeof aiClassificationAnswerSchema>;

type Example = LabelledSpecimen;

// classify()/distanceSq live in @/modules/ai/knn so the player and the
// grader cannot drift apart — see that file's note.
export { classify } from "@/modules/ai/knn";

/**
 * Ground truth: positive when the ruling feature is below the threshold.
 *
 * Exported so the content suite can evaluate authored levels with the SAME
 * function the server grades with. A level whose pool `truth` values disagree
 * with its own `rule` shows a child contradictory evidence and cannot be won
 * by reasoning — and only executing the real rule catches that.
 */
export function trueLabel(
  rule: ClassificationRule,
  probe: { size: number; color: number },
): "positive" | "negative" {
  switch (rule.kind) {
    case "box":
      // Positive only inside BOTH ranges — the one rule kind where neither
      // measurement on its own explains the category.
      return probe.size >= rule.size[0] &&
        probe.size <= rule.size[1] &&
        probe.color >= rule.color[0] &&
        probe.color <= rule.color[1]
        ? "positive"
        : "negative";
    default:
      return probe[rule.feature] < rule.threshold ? "positive" : "negative";
  }
}

function refusal(code: string, data: Record<string, unknown>): ActivityGradeResult {
  return {
    verdict: "FAIL",
    qualityPassed: false,
    primaryFeedback: { code, data },
    generatedCode: "",
    blockCount: null,
    summary: {},
  };
}

function invalid(reason: string): ActivityGradeResult {
  return {
    verdict: "ERROR",
    qualityPassed: false,
    primaryFeedback: { code: "runtimeError", data: { reason } },
    generatedCode: "",
    blockCount: null,
    summary: {},
  };
}

export function gradeAiClassification(
  snapshot: LevelSnapshot,
  answer: AiClassificationAnswer,
): ActivityGradeResult {
  const parsed = aiClassificationPayload.safeParse(snapshot.payload);
  if (!parsed.success) return invalid("invalidPayload");
  const payload = parsed.data;

  // Only specimens that actually belong to this level's pool may be taught
  // with — otherwise a crafted request could invent a perfect training set.
  const poolById = new Map(payload.pool.map((p) => [p.id, p]));
  const heldBack = new Set(payload.holdout ? (answer.checkSet ?? []) : []);
  const examples: Example[] = [];
  for (const example of answer.examples) {
    const known = poolById.get(example.id);
    if (!known) continue;
    // A held-back specimen can never teach, whatever the client claims.
    if (heldBack.has(example.id)) continue;
    // Trust the level's own geometry, never the client's copy of it.
    examples.push({ ...known, label: example.label });
  }

  // Student-designed hold-out (E9). The held-back ids are removed from
  // training BEFORE any other check: a specimen cannot teach and test at
  // once, and a split that pretends otherwise is the exact fraud the level
  // exists to make impossible.
  if (payload.holdout) {
    const held = new Set(answer.checkSet ?? []);
    if (held.size < payload.holdout.min) {
      return refusal("needMoreHeldBack", {
        need: payload.holdout.min,
        got: held.size,
      });
    }
    if (answer.examples.some((e) => held.has(e.id))) {
      return refusal("cannotTeachAndTest", {});
    }
  }

  const positives = examples.filter((e) => e.label === "positive").length;
  const negatives = examples.length - positives;
  if (positives < payload.minPerLabel || negatives < payload.minPerLabel) {
    return {
      verdict: "FAIL",
      qualityPassed: false,
      primaryFeedback: {
        code: "teachBothBuckets",
        data: { need: payload.minPerLabel, positives, negatives },
      },
      generatedCode: "",
      blockCount: null,
      summary: { positives, negatives, taught: examples.length },
    };
  }

  // Hard cap. Without one, "teach it everything" beats any level whose
  // lesson is WHICH examples to choose — and teaching the whole pool
  // already wins berry-sorter. A cap turns "add more until it passes" into
  // "choose well", which is the only version of the task that is about
  // machine learning at all.
  if (payload.maxExamples !== undefined && examples.length > payload.maxExamples) {
    return {
      verdict: "FAIL",
      qualityPassed: false,
      primaryFeedback: {
        code: "tooManyExamples",
        data: { used: examples.length, max: payload.maxExamples },
      },
      generatedCode: "",
      blockCount: examples.length,
      summary: { taught: examples.length, positives, negatives },
    };
  }

  let correct = 0;
  const missed: string[] = [];
  // Errors counted by DIRECTION, not just volume: under a safetyFirst rule
  // a mistake one way is forbidden while the other way is merely budgeted,
  // which is the entire lesson of which-mistake-is-worse.
  let dangerousMisses = 0;
  let falseAlarms = 0;
  const safety = payload.passRule.kind === "safetyFirst" ? payload.passRule : null;
  for (const probe of payload.testSet) {
    const predicted = classify(examples, probe);
    const truth = trueLabel(payload.rule, probe);
    if (predicted === truth) {
      correct += 1;
    } else {
      missed.push(probe.id);
      if (safety && truth === safety.neverMisclassify) dangerousMisses += 1;
      else falseAlarms += 1;
    }
  }
  const passed = safety
    ? dangerousMisses === 0 && falseAlarms <= safety.maxOtherErrors
    : correct === payload.testSet.length;
  // The 3rd star is the budget, and until now it was a lie: this engine
  // returned `qualityPassed: passed`, so ANY pass scored 3 stars, while the
  // comment below claimed the shared maxBlocks machinery was rewarding
  // frugality. That machinery is grid-only (grade.ts gradeWorkspace), so
  // threeStarMaxBlocks was dead data for every AI level. It is live here.
  const budget = payload.starCriteria.threeStarMaxBlocks;
  const withinBudget = budget === undefined || examples.length <= budget;

  return {
    verdict: passed ? "PASS" : "FAIL",
    qualityPassed: passed && withinBudget,
    // Naming WHICH specimens the model got wrong is the whole feedback
    // loop: the student goes back and teaches an example near those.
    primaryFeedback: passed
      ? null
      : {
          // Under safetyFirst the failure NAMES the direction — "you called
          // a dangerous one safe" and "too many false alarms" are different
          // lessons, and a generic wrong-count teaches neither.
          code: safety
            ? dangerousMisses > 0
              ? "calledADangerousOneSafe"
              : "tooManyFalseAlarms"
            : "modelGuessedWrong",
          // `missed` rides on the FEEDBACK, not just the summary: the player
          // reads feedback.data, and "3 of 4 right" without naming which one
          // is an arbitrary verdict a child cannot act on.
          data: {
            correct,
            total: payload.testSet.length,
            missed,
            ...(safety
              ? { dangerousMisses, falseAlarms, maxOtherErrors: safety.maxOtherErrors }
              : {}),
          },
        },
    generatedCode: "",
    // "Examples taught" travels as blockCount so the rest of the pipeline
    // (attempt records, teacher reports, the star computation above) needs
    // no AI-specific field.
    blockCount: examples.length,
    summary: {
      taught: examples.length,
      positives,
      negatives,
      correct,
      total: payload.testSet.length,
      missed,
      ...(safety ? { dangerousMisses, falseAlarms } : {}),
      ...(payload.holdout ? { heldBack: (answer.checkSet ?? []).length } : {}),
    },
  };
}
