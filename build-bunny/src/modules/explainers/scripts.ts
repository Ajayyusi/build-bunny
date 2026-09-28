import type { CharacterId } from "@/modules/characters/cast";
import type { CharacterState } from "@/modules/characters/states";

/**
 * Explainers (handoff: "Video should explain one idea with a concrete
 * mistake, then hand control to the child"; "20 to 40 seconds, then
 * immediately lead to interaction; it must never be required to understand
 * the lesson"; captions, a mute control, keyboard support and reduced
 * motion).
 *
 * Each explainer is data: timed beats (who is on screen, in which state,
 * what the caption says, what the scene shows) and the interactive choice
 * it ends on. The player draws the beats as a captioned scene; production
 * video can replace a script later by adding `video` (a captioned file),
 * and the ending choice stays the same.
 *
 * Captions are message keys (explainers.<id>.beats.<n>, .choice.*), so
 * every line exists in English and Arabic.
 */

export type Colour = "red" | "orange";
export type Tone = "light" | "dark";

export type ExplainerScene =
  /** Shapes on a table; `mark` shows the robot's guess going right or wrong. */
  | { kind: "shapes"; items: { shape: "circle" | "square"; colour: Colour; mark?: "right" | "wrong" | "new" }[] }
  /** A training set of birds by tone, and a new bird the model got wrong. */
  | { kind: "birds"; trained: Record<Tone, number>; newBird?: { tone: Tone; mark: "wrong" | "new" } }
  /** A chatbot's confident answer beside a trusted timetable. */
  | { kind: "source"; show: ("chat" | "timetable" | "check")[] };

export interface ExplainerBeat {
  /** When the beat starts, from the beginning. */
  atMs: number;
  character: CharacterId;
  state: CharacterState;
  scene: ExplainerScene;
}

export interface Explainer {
  id: string;
  /** The level it introduces (offered on that level's briefing). */
  levelSlug: string;
  durationMs: number;
  beats: readonly ExplainerBeat[];
  /** The ending choice: option ids; which one is the one to act on. */
  choice: { options: readonly string[]; best: string };
}

const RED_CIRCLES = Array.from({ length: 4 }, () => ({ shape: "circle" as const, colour: "red" as const }));

export const EXPLAINERS: readonly Explainer[] = [
  {
    // Example 1, 25 s: Ruli learns "red means circle"; Tessa shows an
    // orange circle; Ruli guesses wrong. "I copied the color. What should I
    // look at instead?"
    id: "copied-colour",
    levelSlug: "train-a-sorter",
    durationMs: 25_000,
    beats: [
      { atMs: 0, character: "bunny", state: "idle", scene: { kind: "shapes", items: RED_CIRCLES } },
      { atMs: 5_000, character: "ruli", state: "thinking", scene: { kind: "shapes", items: RED_CIRCLES } },
      { atMs: 10_000, character: "tessa", state: "hint", scene: { kind: "shapes", items: [...RED_CIRCLES, { shape: "circle", colour: "orange", mark: "new" }] } },
      { atMs: 15_000, character: "ruli", state: "error", scene: { kind: "shapes", items: [...RED_CIRCLES, { shape: "circle", colour: "orange", mark: "wrong" }] } },
      { atMs: 20_000, character: "ruli", state: "thinking", scene: { kind: "shapes", items: [...RED_CIRCLES, { shape: "circle", colour: "orange", mark: "wrong" }] } },
    ],
    choice: { options: ["shape", "colour", "size"], best: "shape" },
  },
  {
    // Example 2, 30 s: Noura shows a model trained on many light birds and
    // very few dark ones. It misses a dark bird. "Were our examples fair?"
    id: "fair-examples",
    levelSlug: "bias-detective",
    durationMs: 30_000,
    beats: [
      { atMs: 0, character: "noura", state: "idle", scene: { kind: "birds", trained: { light: 8, dark: 1 } } },
      { atMs: 7_000, character: "noura", state: "hint", scene: { kind: "birds", trained: { light: 8, dark: 1 }, newBird: { tone: "dark", mark: "new" } } },
      { atMs: 14_000, character: "noura", state: "error", scene: { kind: "birds", trained: { light: 8, dark: 1 }, newBird: { tone: "dark", mark: "wrong" } } },
      { atMs: 21_000, character: "noura", state: "thinking", scene: { kind: "birds", trained: { light: 8, dark: 1 }, newBird: { tone: "dark", mark: "wrong" } } },
    ],
    choice: { options: ["moreDark", "moreLight", "noMore"], best: "moreDark" },
  },
  {
    // Example 3, 30 s: an assistant confidently invents a library closing
    // time; the child compares a trusted school timetable and chooses to
    // verify before sharing.
    id: "check-the-source",
    levelSlug: "two-answers",
    durationMs: 30_000,
    beats: [
      { atMs: 0, character: "bunny", state: "idle", scene: { kind: "source", show: ["chat"] } },
      { atMs: 8_000, character: "noura", state: "thinking", scene: { kind: "source", show: ["chat"] } },
      { atMs: 15_000, character: "noura", state: "hint", scene: { kind: "source", show: ["chat", "timetable"] } },
      { atMs: 22_000, character: "tessa", state: "listening", scene: { kind: "source", show: ["chat", "timetable", "check"] } },
    ],
    choice: { options: ["checkFirst", "shareNow", "askAgain"], best: "checkFirst" },
  },
];

export const EXPLAINER_FOR_LEVEL: Readonly<Record<string, string>> = Object.fromEntries(
  EXPLAINERS.map((explainer) => [explainer.levelSlug, explainer.id]),
);

export function explainerById(id: string): Explainer | undefined {
  return EXPLAINERS.find((explainer) => explainer.id === id);
}

/** The beat showing at `ms` (the last one that has started). */
export function beatIndexAt(explainer: Explainer, ms: number): number {
  let index = 0;
  explainer.beats.forEach((beat, i) => {
    if (beat.atMs <= ms) index = i;
  });
  return index;
}
