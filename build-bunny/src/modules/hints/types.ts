import type { MazeIssue } from "@/modules/activities/maze";

/**
 * "Show me the next step" is recorded as this hint tier: above the authored
 * ladder (1–4), so computeStars' existing tier-3+ rule caps the level at two
 * stars, and a teacher's attempt view can tell it apart from the ladder.
 */
export const NEXT_STEP_TIER = 5;

/**
 * "Show me the next step" results, shared by the server that computes them
 * (hints/server/next-step.ts) and the players that render them.
 */

/** Where a block goes, in terms of the child's own program (1-based blocks). */
export type BlockPlace =
  | { kind: "start" }
  | { kind: "after"; index: number; block: string }
  | { kind: "inside"; index: number; block: string; mouth: "DO" | "ELSE" }
  | { kind: "condition"; index: number; block: string }
  | { kind: "newTrick" }
  | { kind: "insideTrick" };

/** The rule round's buttons, in the order a child meets them. */
export type RuleRoundButton = "testRule" | "seeToday" | "teachInstead";

export type NextStep =
  /** Nothing to change: the current work already passes. `better` = passes without the top star. */
  | { code: "ready"; better?: boolean }
  | { code: "addBlock"; block: string; place: BlockPlace; value?: number }
  | { code: "removeBlock"; index: number; block: string }
  | { code: "changeBlock"; index: number; from: string; to: string; value?: number }
  | { code: "setNumber"; index: number; block: string; value: number }
  | { code: "moveBlock"; index: number; block: string; place: BlockPlace }
  | { code: "looseBlock"; block: string }
  | { code: "fillGap"; block: string }
  | { code: "ruleOut"; optionId: string }
  | { code: "answerIs"; optionId: string }
  | { code: "moveItem"; itemId: string; position: number }
  | { code: "teach"; specimenId: string; label: "positive" | "negative" }
  | { code: "takeBack"; specimenId: string }
  | { code: "keepForTesting"; specimenId: string }
  /** Rule or Examples?: try this rule card (then test it). */
  | { code: "tryRule"; ruleId: string }
  /** Rule or Examples?: the next button to press in the rule round. */
  | { code: "pressButton"; button: RuleRoundButton }
  | { code: "plantFlag"; size: number; color: number }
  | { code: "liftFlag"; index: number }
  | { code: "strikeReading"; specimenId: string }
  | { code: "restoreReading"; specimenId: string }
  | { code: "chooseSafe"; choiceId: string }
  | { code: "nudgeLine"; end: "left" | "right"; dir: "up" | "down" }
  | { code: "revealComputer" }
  | { code: "setPrediction"; value: number }
  | { code: "pickPicture"; roundId: string; imageId: string }
  | { code: "designAdd"; tile: "#" | "W" | "C"; x: number; y: number }
  | { code: "designRemove"; x: number; y: number }
  | { code: "designGoal"; x: number; y: number }
  | { code: "designFix"; issue: MazeIssue["code"] }
  | { code: "none" };
