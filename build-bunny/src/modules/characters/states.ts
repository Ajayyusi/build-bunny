/**
 * Character states and motion timings (handoff: "Keep faces and clothing
 * consistent across idle, listening, thinking, error, hint and celebration
 * animations"; "subtle 2 to 4 second idle loop; reaction 0.5 to 1 second
 * after a choice; celebratory motion under 2 seconds; one hint gesture
 * toward the relevant object").
 *
 * Pure: the component and the hook read these, and the unit suite pins
 * them to the spec. Feedback follows a choice and then settles back to
 * idle — no continuous distracting movement.
 */

export const CHARACTER_STATES = ["idle", "listening", "thinking", "error", "hint", "celebration"] as const;
export type CharacterState = (typeof CHARACTER_STATES)[number];

/** Milliseconds. Each value sits inside the handoff's range. */
export const MOTION_MS = {
  /** One idle loop (blink, small breath): 2 to 4 s. */
  idleLoop: 3200,
  /** A reaction after a choice (listening, error): 0.5 to 1 s. */
  reaction: 750,
  /** The one hint gesture toward the relevant object: a reaction too. */
  hint: 900,
  /** Celebration: under 2 s. */
  celebration: 1600,
} as const;

/** What happened, from the player's point of view. */
export type CharacterEvent =
  /** The child made a choice (tapped an example, picked an answer). */
  | "choice"
  /** A check or test came back wrong. */
  | "wrong"
  /** A check or test came back right. */
  | "right"
  /** A hint is pointing at something. */
  | "hint"
  /** The machine is working something out (held until the next event). */
  | "think"
  /** Nothing to react to: back to idle. */
  | "settle";

export interface Reaction {
  state: CharacterState;
  /** How long to hold before settling to idle; null = hold until the next event. */
  holdMs: number | null;
}

export function reactTo(event: CharacterEvent): Reaction {
  switch (event) {
    case "choice":
      return { state: "listening", holdMs: MOTION_MS.reaction };
    case "wrong":
      return { state: "error", holdMs: MOTION_MS.reaction };
    case "right":
      return { state: "celebration", holdMs: MOTION_MS.celebration };
    case "hint":
      return { state: "hint", holdMs: MOTION_MS.hint };
    case "think":
      return { state: "thinking", holdMs: null };
    case "settle":
      return { state: "idle", holdMs: null };
  }
}

/** CSS animation length for a state (the idle loop repeats; the rest play once). */
export function animationMs(state: CharacterState): number {
  switch (state) {
    case "idle":
      return MOTION_MS.idleLoop;
    case "celebration":
      return MOTION_MS.celebration;
    case "hint":
      return MOTION_MS.hint;
    case "thinking":
      // Thinking holds, but its motion is one gentle reaction, not a loop.
      return MOTION_MS.reaction;
    default:
      return MOTION_MS.reaction;
  }
}
