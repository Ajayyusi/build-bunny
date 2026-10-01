import type { ExploreConcept } from "./catalog";

/**
 * "Explain it in your own words", privacy-safe (handoff: every AI lesson
 * produces an explanation in the learner's own words; store how they
 * explained it). A child builds "… because …, so …" from three phrases
 * for the idea they just met. Only the phrase ids are stored — never
 * anything typed — and a teacher sees the sentence and whether each part
 * holds up. Which phrases hold up is server-side (explanations-key.ts).
 *
 * Client-safe. Copy: student.play.explain.<concept>.<phraseId>.
 */

export const EXPLAIN_SLOTS = ["what", "why", "next"] as const;
export type ExplainSlot = (typeof EXPLAIN_SLOTS)[number];

/** The ideas a sentence can be about: the quick-check ideas, and five more
 *  so that every AI lesson has one. */
export type ExplainConcept =
  | ExploreConcept
  | "patterns"
  | "testing"
  | "privacy"
  | "language";

export const EXPLAIN_CONCEPTS: readonly ExplainConcept[] = [
  "examples",
  "rules",
  "vision",
  "fairness",
  "checking",
  "prediction",
  "people",
  "dataQuality",
  "patterns",
  "testing",
  "privacy",
  "language",
];

/**
 * Every AI lesson (lessonKindOf "ai") and the idea its sentence is about.
 * A level with a quick check uses the same idea as its check.
 */
export const EXPLAIN_CONCEPT_FOR_LEVEL: Readonly<Record<string, ExplainConcept>> = {
  // Learning from examples.
  "train-a-sorter": "examples",
  "berry-sorter": "examples",
  "seed-sorter": "examples",
  "three-examples-only": "examples",
  "draw-the-line": "examples",
  "desert-flowers": "examples",
  "nothing-rules-alone": "examples",
  "you-be-the-classifier": "examples",
  "mirage-pattern": "examples",
  "rule-or-examples": "rules",
  "see-like-a-computer": "vision",
  "bias-detective": "fairness",
  "is-that-real": "checking",
  "two-answers": "checking",
  "fortune-teller": "prediction",
  "who-decides": "people",
  // Bad data.
  "the-berry-that-lied": "dataQuality",
  "impossible-reading": "dataQuality",
  "one-strange-reading": "dataQuality",
  // Finding groups without labels.
  "two-piles": "patterns",
  "how-many-kinds": "patterns",
  "three-waterholes": "patterns",
  "close-crowds": "patterns",
  "four-camps": "patterns",
  "let-it-run": "patterns",
  // Testing fairly.
  "keep-some-back": "testing",
  "which-mistake-is-worse": "testing",
  "my-ai-project": "testing",
  "need-to-know": "privacy",
  "say-it-clearly": "language",
};

export function explainConceptFor(slug: string): ExplainConcept | null {
  return EXPLAIN_CONCEPT_FOR_LEVEL[slug] ?? null;
}

/** Three phrases per slot, as ids: what1..3, why1..3, next1..3. */
export function phrasesFor(slot: ExplainSlot): string[] {
  return [1, 2, 3].map((n) => `${slot}${n}`);
}

/** A stored part is "<concept>.<phrase>", e.g. "examples.why2". */
export function partId(concept: string, phrase: string): string {
  return `${concept}.${phrase}`;
}

/** Valid: exactly one phrase per slot, in order, all for this concept. */
export function isValidSentence(concept: ExplainConcept, parts: readonly string[]): boolean {
  if (parts.length !== EXPLAIN_SLOTS.length) return false;
  return EXPLAIN_SLOTS.every((slot, i) => phrasesFor(slot).map((p) => partId(concept, p)).includes(parts[i]!));
}
