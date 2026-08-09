/**
 * Pure engine contracts (M3, pinned in m3-contracts). The engine runs
 * identically in the browser (optimistic animation) and on the server
 * (authoritative grading), so everything here is deterministic data:
 * no clocks, no randomness, no imports from outside src/engine.
 */

export type Direction = "N" | "E" | "S" | "W";

export interface Pose {
  x: number;
  y: number;
  dir: Direction;
}

export interface EngineConfig {
  autoCollect: boolean;
  nonFatalBumps: boolean;
  maxCommands: number;
}

/** ".#CGW" legend — same shape as gridVariantSchema in curriculum schemas. */
export interface GridVariantSpec {
  rows: string[];
  start: Pose;
}

export type EngineCommand =
  | { type: "moveForward" }
  | { type: "turnLeft" }
  | { type: "turnRight" }
  | { type: "collect" }
  | { type: "say"; text: string };

export type SensorQuery = { type: "pathAhead" } | { type: "onGoal" };

export type EngineEvent =
  | { type: "start"; pose: Pose }
  | { type: "move"; from: Pose; to: Pose; step: number }
  | { type: "turn"; dir: "left" | "right"; pose: Pose; step: number }
  | { type: "collect"; x: number; y: number; step: number; auto: boolean }
  | { type: "collectFail"; step: number }
  | { type: "bump"; x: number; y: number; step: number }
  | { type: "splash"; x: number; y: number; step: number }
  | { type: "say"; text: string; step: number }
  // Emitted at finish() when the final pose sits on the goal (end-state rule).
  | { type: "goal"; step: number }
  | { type: "budgetExceeded"; step: number };

export type Termination =
  | "COMPLETED"
  | "BUMPED"
  | "SPLASHED"
  | "BUDGET_EXCEEDED"
  | "RUNTIME_ERROR";

export interface RunResult {
  events: EngineEvent[];
  termination: Termination;
  reachedGoal: boolean;
  collected: number;
  totalCollectables: number;
  finalPose: Pose;
  commandCount: number;
  sayOutputs: string[];
}

// ── Check contracts ──────────────────────────────────────────────────────
// Structurally identical to checkSchema in @/modules/curriculum/schemas —
// duplicated here because the engine may not import app modules (ESLint
// fence). TypeScript's structural typing keeps callers compatible; the
// canonical id registry lives in the curriculum schemas.

export const CHECK_IDS = [
  "reachedGoal",
  "collectedAll",
  "avoidedTiles",
  "usedBlock",
  "notUsedBlock",
  "maxBlocks",
  "variableEquals",
  "expectedOutput",
  "expectedSequence",
  "classifierResult",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export type CheckSeverity = "core" | "secondary" | "quality";

export interface Check {
  id: CheckId;
  severity: CheckSeverity;
  params?: Record<string, unknown>;
}

/** Attempt verdicts — ERROR is infrastructure failure, assigned app-side. */
export type Verdict = "PASS" | "PARTIAL" | "FAIL" | "ERROR";
