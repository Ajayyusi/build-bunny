import "server-only";

import { z } from "zod";

import { aiEthicsPayload } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { resolveNextSceneIndex, type ActivityGradeResult } from "../types";

/**
 * AI_ETHICS engine (phase G, AI Island "Secret Keepers"): a branching
 * privacy scenario. There are no wrong feelings — grading is completion-
 * based (finishing the story is a PASS) and the only thing that varies is
 * the star count, which rewards having chosen the `safe` option at every
 * scene actually visited (branching can skip scenes, so "every scene" means
 * every scene THIS path walked through, not every authored scene). Copy
 * never scolds a wrong choice; the outcome text is the teaching moment, not
 * a verdict, so a "wrong" choice is never surfaced as one.
 */

// The answer-free student mirror lives in ./student-views.ts (strict, so a
// strip regression fails loudly at the play page rather than leaking `safe`).

const pathStepSchema = z.object({
  sceneId: z.string().min(1),
  choiceId: z.string().min(1),
});

export const aiEthicsAnswerSchema = z.object({
  path: z.array(pathStepSchema).min(1),
});
export type AiEthicsAnswer = z.infer<typeof aiEthicsAnswerSchema>;

function invalidPath(): ActivityGradeResult {
  return {
    verdict: "ERROR",
    qualityPassed: false,
    primaryFeedback: { code: "runtimeError", data: { reason: "invalidPath" } },
    generatedCode: "",
    blockCount: null,
    summary: {},
  };
}

export function gradeAiEthics(
  snapshot: LevelSnapshot,
  answer: AiEthicsAnswer,
): ActivityGradeResult {
  const parsed = aiEthicsPayload.safeParse(snapshot.payload);
  if (!parsed.success) {
    return {
      verdict: "ERROR",
      qualityPassed: false,
      primaryFeedback: { code: "runtimeError", data: { reason: "invalidPayload" } },
      generatedCode: "",
      blockCount: null,
      summary: {},
    };
  }
  const { scenes } = parsed.data;

  // Re-walk the branching story server-side from scene 0 using the SAME
  // resolution rule the player used to build this path (resolveNextSceneIndex,
  // shared in ../types) — what the child experienced and what gets graded
  // can never diverge. A path that doesn't match a real traversal (tampered
  // sceneId/choiceId, or one that stops short of the story's end) is an
  // infrastructure-level ERROR, not a "wrong" story choice.
  let index = 0;
  let allSafe = true;
  for (const step of answer.path) {
    const scene = scenes[index];
    if (!scene || scene.id !== step.sceneId) return invalidPath();
    const choice = scene.choices.find((c) => c.id === step.choiceId);
    if (!choice) return invalidPath();
    if (!choice.safe) allSafe = false;
    index = resolveNextSceneIndex(scenes, index, choice.next);
  }
  if (index < scenes.length) return invalidPath(); // story not finished yet

  return {
    verdict: "PASS",
    qualityPassed: allSafe,
    primaryFeedback: null,
    generatedCode: "",
    blockCount: null,
    summary: { path: answer.path, allSafe, scenesVisited: answer.path.length },
  };
}
