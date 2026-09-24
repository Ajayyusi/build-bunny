import type { MazeIssue } from "@/modules/activities/maze";

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
