import "server-only";

import { z } from "zod";

import { localizedText, sequencingPayload } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import type { ActivityGradeResult } from "../types";

/**
 * SEQUENCING engine (m4 task 4). Student reorders shuffled steps of a
 * routine; grading is a straight array comparison against correctOrder,
 * which never leaves the server.
 */

/**
 * Answer-free mirror of sequencingPayload (curriculum/schemas.ts) — see
 * code-prediction.ts's schema comment for why this exists instead of
 * re-parsing the stripped object against the authoring schema.
 */
export const sequencingStudentPayload = z.object({
  prompt: localizedText,
  items: z
    .array(z.object({ id: z.string().min(1), text: localizedText }))
    .min(3)
    .max(8),
});

export const sequencingAnswerSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});
export type SequencingAnswer = z.infer<typeof sequencingAnswerSchema>;

/**
 * Small deterministic PRNG (mulberry32) seeded from a string hash — good
 * enough for "shuffle the same way for the same student every time", not a
 * cryptographic requirement. Kept local: this is presentation shuffling, not
 * grading, so it deliberately never sees correctOrder.
 */
function seededRandom(seedInput: string): () => number {
  let h = 1779033703 ^ seedInput.length;
  for (let i = 0; i < seedInput.length; i++) {
    h = Math.imul(h ^ seedInput.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let seed = h >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle keyed by (levelId, studentUserId): the
 * same student always sees the same starting order for a level (stable
 * across reloads), while different students see different shuffles.
 */
export function shuffleSequencingItems<T>(items: T[], seedKey: string): T[] {
  const random = seededRandom(seedKey);
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function gradeSequencing(
  snapshot: LevelSnapshot,
  answer: SequencingAnswer,
): ActivityGradeResult {
  const parsed = sequencingPayload.safeParse(snapshot.payload);
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
  const payload = parsed.data;
  const correct = arraysEqual(answer.order, payload.correctOrder);
  return {
    verdict: correct ? "PASS" : "FAIL",
    qualityPassed: correct,
    primaryFeedback: correct ? null : { code: "wrongOrder" },
    generatedCode: "",
    blockCount: null,
    summary: { order: answer.order, correct },
  };
}
