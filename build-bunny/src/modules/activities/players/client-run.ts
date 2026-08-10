import {
  aggregateVerdict,
  computeStars,
  evaluateChecks,
  type Check,
  type CheckFailure,
} from "@/engine";
import { registerBunnyBlocks, type BlockLocale } from "@/modules/blockly/blocks";
import {
  buildDisplayGenerator,
  buildRunnableGenerator,
  type BunnyGenerator,
} from "@/modules/blockly/codegen";
import {
  runProgramAllVariants,
  type ProgramRun,
  type RunnableLevelConfig,
} from "@/modules/blockly/interpreter";
import { computeBlockStats, jsonToWorkspace } from "@/modules/blockly/serialization";

import type { ActivityFeedback, GridActivityPayload } from "../types";

/**
 * Client-side optimistic run for the grid engine (BLOCK_CODING/DEBUGGING):
 * same engine, same generators, same checks as the server — the animation
 * starts instantly while the authoritative POST is in flight. Nothing
 * computed here is trusted for stars/XP/unlocks; the server response
 * reconciles the verdict afterwards.
 */

let runnableGen: BunnyGenerator | null = null;
let displayGen: BunnyGenerator | null = null;

function generators(): { runnable: BunnyGenerator; display: BunnyGenerator } {
  runnableGen ??= buildRunnableGenerator();
  displayGen ??= buildDisplayGenerator();
  return { runnable: runnableGen, display: displayGen };
}

/** Display-generator pass only — feeds the BLOCKS ⇄ CODE toggle. */
export function generateDisplayCode(
  workspaceJson: unknown,
  locale: BlockLocale,
): string {
  registerBunnyBlocks(locale);
  const workspace = jsonToWorkspace(workspaceJson);
  try {
    return generators().display.workspaceToCode(workspace);
  } finally {
    workspace.dispose();
  }
}

/**
 * Run one authored program against one grid for PLAYBACK ONLY — no checks, no
 * verdict, no stars, nothing posted. The Learn step's worked example uses
 * this: it is a demonstration the student watches, not an attempt they make.
 * Returns null if the program cannot be generated (malformed authored JSON),
 * so the caller can fall back to a static grid rather than crash the lesson.
 */
export function runForPlayback(
  workspaceJson: unknown,
  config: RunnableLevelConfig,
  locale: BlockLocale,
): ProgramRun | null {
  registerBunnyBlocks(locale);
  const workspace = jsonToWorkspace(workspaceJson);
  let code: string;
  try {
    code = generators().runnable.workspaceToCode(workspace);
  } catch {
    return null;
  } finally {
    workspace.dispose();
  }
  return runProgramAllVariants(code, config)[0] ?? null;
}

export interface LocalRunOutcome {
  runs: ProgramRun[];
  displayCode: string;
  verdict: "PASS" | "PARTIAL" | "FAIL";
  stars: number;
  qualityPassed: boolean;
  feedback: ActivityFeedback | null;
  /** Variant playback shows: the first failing one, else the first. */
  playbackIndex: number;
}

/** Pick the message the student needs most: core > secondary > quality. */
function primaryFeedback(perVariant: CheckFailure[][]): ActivityFeedback | null {
  for (const severity of ["core", "secondary", "quality"] as const) {
    for (const failures of perVariant) {
      const hit = failures.find((f) => f.severity === severity);
      if (hit) return { code: hit.code, data: hit.data };
    }
  }
  return null;
}

export function runLocally(
  workspaceJson: unknown,
  payload: GridActivityPayload,
  locale: BlockLocale,
  hintTierUsed: number,
): LocalRunOutcome {
  registerBunnyBlocks(locale);
  const { runnable, display } = generators();
  const workspace = jsonToWorkspace(workspaceJson);
  let code: string;
  let displayCode: string;
  try {
    code = runnable.workspaceToCode(workspace);
    displayCode = display.workspaceToCode(workspace);
  } finally {
    workspace.dispose();
  }

  const runs = runProgramAllVariants(code, payload);
  const blockStats = computeBlockStats(workspaceJson);

  // Mirror of grading: authored checks + the starCriteria-derived quality
  // block budget (threeStarMaxBlocks → maxBlocks/quality).
  const checks: Check[] = [...payload.checks];
  const threeStarMax = payload.starCriteria.threeStarMaxBlocks;
  if (threeStarMax !== undefined) {
    checks.push({
      id: "maxBlocks",
      severity: "quality",
      params: { max: threeStarMax },
    });
  }

  const perVariant = runs.map((run) => evaluateChecks(checks, run, blockStats));
  const verdict = aggregateVerdict(
    perVariant,
    runs.map((run) => run.termination),
  );
  const qualityPassed = perVariant.every(
    (failures) => !failures.some((f) => f.severity === "quality"),
  );
  const stars = computeStars(verdict, qualityPassed, hintTierUsed);

  let playbackIndex = runs.findIndex(
    (run, i) =>
      run.termination !== "COMPLETED" ||
      perVariant[i]!.some((f) => f.severity === "core"),
  );
  if (playbackIndex === -1) playbackIndex = 0;

  return {
    runs,
    displayCode,
    verdict,
    stars,
    qualityPassed,
    feedback: primaryFeedback(perVariant),
    playbackIndex,
  };
}
