/**
 * Explore AI (product redesign brief, 2026-09-25): six AI activities a child
 * can open from their very first session, with no coding before them.
 *
 * Train a Sorter is the brief's first activity, built for it; the other
 * five are existing levels that already teach their idea hands-on ("Make a
 * Prediction" is Fortune Teller, and so on), so the hub is a new front door,
 * not a second curriculum. The unlock engine opens every level named here
 * as soon as its world is in the child's programme (unlockSource EXPLORE).
 *
 * Client-safe: no server imports. Copy lives in messages under
 * student.explore.*, keyed by `concept`.
 */

export type ExploreConcept =
  | "examples"
  | "rules"
  | "vision"
  | "fairness"
  | "checking"
  | "prediction"
  | "people";

export interface ExploreCard {
  slug: string;
  concept: ExploreConcept;
  /** Decorative; the card's text carries the meaning. The card's colour is
   *  its world's Toy Box colour, so a card looks like the place it opens. */
  glyph: string;
}

/** The six cards, in the order a child should meet them. */
export const EXPLORE_CARDS: readonly ExploreCard[] = [
  { slug: "train-a-sorter", concept: "examples", glyph: "🔷" },
  { slug: "see-like-a-computer", concept: "vision", glyph: "👀" },
  { slug: "bias-detective", concept: "fairness", glyph: "⚖️" },
  { slug: "is-that-real", concept: "checking", glyph: "🔍" },
  { slug: "fortune-teller", concept: "prediction", glyph: "📈" },
  { slug: "who-decides", concept: "people", glyph: "🙋" },
];

/**
 * What follows the first sorter on AI Island's trail, in order: Teach the
 * Bunny (a second sorter, with guesses to predict first), then the bridge
 * the brief asks for — write a rule, then teach by example, and compare.
 * They unlock the normal way, one after the other; the hub shows the first
 * one not yet finished as the next step rather than as a seventh door.
 */
export const EXPLORE_FOLLOW_UPS: readonly ExploreCard[] = [
  { slug: "berry-sorter", concept: "examples", glyph: "🫐" },
  { slug: "rule-or-examples", concept: "rules", glyph: "📏" },
];

/** Every level the hub leads to: the six cards and their follow-ups. */
export const EXPLORE_LEVEL_SLUGS: ReadonlySet<string> = new Set(
  [...EXPLORE_CARDS, ...EXPLORE_FOLLOW_UPS].map((card) => card.slug),
);

/** Levels the unlock engine opens from day one. */
export const EXPLORE_SLUGS: ReadonlySet<string> = new Set(EXPLORE_CARDS.map((card) => card.slug));

/**
 * The one-tap "explain it" check after an AI activity (the brief's "one
 * short explanation", without storing anything a child typed). Three fixed
 * choices per level; `correct` names the right one. Question and choice copy
 * lives in messages under student.explore.check.<concept>.
 */
export const CONCEPT_CHECKS: Readonly<Record<string, { concept: ExploreConcept; correct: "a" | "b" | "c" }>> = {
  "train-a-sorter": { concept: "examples", correct: "b" },
  "berry-sorter": { concept: "examples", correct: "b" },
  "rule-or-examples": { concept: "rules", correct: "c" },
  "see-like-a-computer": { concept: "vision", correct: "a" },
  "bias-detective": { concept: "fairness", correct: "c" },
  "is-that-real": { concept: "checking", correct: "b" },
  "fortune-teller": { concept: "prediction", correct: "a" },
  "who-decides": { concept: "people", correct: "b" },
};

export const CHECK_CHOICES = ["a", "b", "c"] as const;
export type CheckChoice = (typeof CHECK_CHOICES)[number];
