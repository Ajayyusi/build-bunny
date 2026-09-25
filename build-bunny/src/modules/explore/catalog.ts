/**
 * Explore AI (product redesign brief, 2026-09-25): six AI activities a child
 * can open from their very first session, with no coding before them.
 *
 * They are existing levels, not copies. Each one already teaches its idea
 * hands-on — the brief's "Train a Sorter" is Teach the Bunny, "Make a
 * Prediction" is Fortune Teller, and so on — so the hub is a new front door,
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
  { slug: "berry-sorter", concept: "examples", glyph: "🫐" },
  { slug: "see-like-a-computer", concept: "vision", glyph: "👀" },
  { slug: "bias-detective", concept: "fairness", glyph: "⚖️" },
  { slug: "is-that-real", concept: "checking", glyph: "🔍" },
  { slug: "fortune-teller", concept: "prediction", glyph: "📈" },
  { slug: "who-decides", concept: "people", glyph: "🙋" },
];

/**
 * The bridge the brief asks for right after the first sorter: write a rule,
 * then teach by example, and compare. It follows Teach the Bunny in AI
 * Island's first module, so it unlocks the normal way once that is done —
 * the hub shows it as the next step rather than as a seventh door.
 */
export const EXPLORE_FOLLOW_UP: ExploreCard = {
  slug: "rule-or-examples",
  concept: "rules",
  glyph: "📏",
};

/** Levels the unlock engine opens from day one. */
export const EXPLORE_SLUGS: ReadonlySet<string> = new Set(EXPLORE_CARDS.map((card) => card.slug));

/**
 * The one-tap "explain it" check after an AI activity (the brief's "one
 * short explanation", without storing anything a child typed). Three fixed
 * choices per level; `correct` names the right one. Question and choice copy
 * lives in messages under student.explore.check.<concept>.
 */
export const CONCEPT_CHECKS: Readonly<Record<string, { concept: ExploreConcept; correct: "a" | "b" | "c" }>> = {
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
