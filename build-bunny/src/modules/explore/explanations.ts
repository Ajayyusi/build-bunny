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

/** The concepts with a builder: those with a quick check. */
export const EXPLAIN_CONCEPTS: readonly ExploreConcept[] = ["examples", "rules", "vision", "fairness", "checking", "prediction", "people"];

/** Three phrases per slot, as ids: what1..3, why1..3, next1..3. */
export function phrasesFor(slot: ExplainSlot): string[] {
  return [1, 2, 3].map((n) => `${slot}${n}`);
}

/** A stored part is "<concept>.<phrase>", e.g. "examples.why2". */
export function partId(concept: string, phrase: string): string {
  return `${concept}.${phrase}`;
}

/** Valid: exactly one phrase per slot, in order, all for this concept. */
export function isValidSentence(concept: ExploreConcept, parts: readonly string[]): boolean {
  if (parts.length !== EXPLAIN_SLOTS.length) return false;
  return EXPLAIN_SLOTS.every((slot, i) => phrasesFor(slot).map((p) => partId(concept, p)).includes(parts[i]!));
}
