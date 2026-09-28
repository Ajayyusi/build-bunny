import type { CharacterState } from "./states";

/**
 * The cast (handoff: "one main rabbit superhero guide with a small
 * supporting cast … Each character has one teaching job and short
 * repeatable lines").
 *
 *  - Robo Bunny, the warm host who invites play.
 *  - Ruli Rule Bot follows explicit instructions: rules versus learning.
 *  - Tessa Test Tortoise tries new cases and spots failures: testing.
 *  - Noura Houbara asks about fairness, evidence, privacy and who makes the
 *    final decision.
 *
 * Names, jobs and lines are message keys (characters.<id>.*), so every
 * line exists in English and Arabic. Lines are keyed by teaching moment,
 * and a player only asks a character for a line from its own job.
 *
 * Art is swappable: today every character is an original SVG placeholder
 * drawn in CharacterArt.tsx. Production art replaces it per state by
 * listing image paths under `art` (transparent WebP/PNG in
 * public/characters/<id>/); a state without an image falls back to the
 * placeholder, so art can land one state at a time.
 */

export const CHARACTER_IDS = ["bunny", "ruli", "tessa", "noura"] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export type TeachingJob = "host" | "rules" | "testing" | "fairness";

export interface CharacterDef {
  id: CharacterId;
  job: TeachingJob;
  /** Accent colour token for the speech bubble edge (a CSS variable). */
  accent: string;
  /** The character's lines, by teaching moment (message keys under characters.<id>.lines). */
  lines: readonly string[];
  /** Production art by state; empty = the SVG placeholder for every state. */
  art: Partial<Record<CharacterState, string>>;
}

export const CAST: Readonly<Record<CharacterId, CharacterDef>> = {
  bunny: {
    id: "bunny",
    job: "host",
    accent: "var(--color-brand)",
    lines: ["letsFindOut", "tryAndSee", "goodExperiment"],
    art: {},
  },
  ruli: {
    id: "ruli",
    job: "rules",
    accent: "var(--color-info)",
    lines: ["followExactly", "cantSeeThat", "someoneRewrites"],
    art: {},
  },
  tessa: {
    id: "tessa",
    job: "testing",
    accent: "var(--color-teal, #0f766e)",
    lines: ["newExample", "neverSeen", "foundAMistake", "outsideTheData"],
    art: {},
  },
  noura: {
    id: "noura",
    job: "fairness",
    accent: "var(--color-warning)",
    lines: ["fairExamples", "whoIsAffected", "enoughEvidence", "whoDecides", "whatDoesItNeed"],
    art: {},
  },
};

/** A line key for this character, or throws: a player can't borrow another character's job. */
export function lineKey(id: CharacterId, line: string): string {
  if (!CAST[id].lines.includes(line)) throw new Error(`${id} has no line "${line}"`);
  return `${id}.lines.${line}`;
}
