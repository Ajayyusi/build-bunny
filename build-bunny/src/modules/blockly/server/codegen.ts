import "server-only";
import type { BlockStats } from "@/engine";
import { registerBunnyBlocks } from "../blocks";
import { buildRunnableGenerator, type BunnyGenerator } from "../codegen";
import {
  computeBlockStats,
  jsonToWorkspace,
  validateWhitelist,
  type BlockRef,
} from "../serialization";

/**
 * Headless Blockly codegen for authoritative grading (m3 contract). This is
 * the ONLY sanctioned server entry into Blockly: it re-generates code from
 * the submitted workspace JSON, so nothing the client claims about its own
 * program is ever trusted.
 */

/** Thrown when workspace JSON uses blocks outside the level toolbox — the
 * grading route maps it to an ERROR verdict, never a crash. */
export class WhitelistViolationError extends Error {
  constructor(public readonly violations: string[]) {
    super(`Workspace violates level toolbox: ${violations.join("; ")}`);
    this.name = "WhitelistViolationError";
  }
}

let runnableGenerator: BunnyGenerator | null = null;

/**
 * Workspace JSON → runnable ES5 + block stats. Registers blocks on first
 * use (labels are irrelevant headless, so the locale is fixed to "en").
 */
export function generateRunnableCode(
  workspaceJson: unknown,
  toolbox: BlockRef[],
): { code: string; blockStats: BlockStats } {
  registerBunnyBlocks("en");

  const violations = validateWhitelist(workspaceJson, toolbox);
  if (violations.length > 0) throw new WhitelistViolationError(violations);

  runnableGenerator ??= buildRunnableGenerator();
  const workspace = jsonToWorkspace(workspaceJson);
  try {
    const code = runnableGenerator.workspaceToCode(workspace);
    return { code, blockStats: computeBlockStats(workspaceJson) };
  } finally {
    workspace.dispose();
  }
}
