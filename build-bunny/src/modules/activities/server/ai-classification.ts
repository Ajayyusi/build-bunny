import "server-only";

import { z } from "zod";

import { classify, type LabelledSpecimen } from "@/modules/ai/knn";
import { aiClassificationPayload } from "@/modules/curriculum/schemas";
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

const labelledSpecimen = z.object({
  id: z.string().min(1),
  size: z.number().min(0).max(1),
  color: z.number().min(0).max(1),
  label: z.enum(["positive", "negative"]),
});

export const aiClassificationAnswerSchema = z.object({
  /** Every specimen the student dragged into a bucket. */
  examples: z.array(labelledSpecimen).min(1).max(64),
});
export type AiClassificationAnswer = z.infer<typeof aiClassificationAnswerSchema>;

type Example = LabelledSpecimen;

// classify()/distanceSq live in @/modules/ai/knn so the player and the
// grader cannot drift apart — see that file's note.
export { classify } from "@/modules/ai/knn";

/** Ground truth: positive when the ruling feature is below the threshold. */
function trueLabel(
  rule: { feature: "size" | "color"; threshold: number },
  probe: { size: number; color: number },
): "positive" | "negative" {
  return probe[rule.feature] < rule.threshold ? "positive" : "negative";
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
  const examples: Example[] = [];
  for (const example of answer.examples) {
    const known = poolById.get(example.id);
    if (!known) continue;
    // Trust the level's own geometry, never the client's copy of it.
    examples.push({ ...known, label: example.label });
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

  let correct = 0;
  const missed: string[] = [];
  for (const probe of payload.testSet) {
    const predicted = classify(examples, probe);
    if (predicted === trueLabel(payload.rule, probe)) correct += 1;
    else missed.push(probe.id);
  }
  const passed = correct === payload.testSet.length;

  return {
    verdict: passed ? "PASS" : "FAIL",
    qualityPassed: passed,
    // Naming WHICH specimens the model got wrong is the whole feedback
    // loop: the student goes back and teaches an example near those.
    primaryFeedback: passed
      ? null
      : { code: "modelGuessedWrong", data: { correct, total: payload.testSet.length } },
    generatedCode: "",
    // Reusing blockCount as "examples taught" is what lets the shared
    // maxBlocks/threeStarMaxBlocks star machinery reward teaching it with
    // fewer, better-chosen examples — no new star pathway needed.
    blockCount: examples.length,
    summary: {
      taught: examples.length,
      positives,
      negatives,
      correct,
      total: payload.testSet.length,
      missed,
    },
  };
}
