import type { Workspace } from "blockly/core";
import type { BlockStats } from "@/engine";
import { Blockly } from "./blockly-core";
import {
  BUNNY_HAT_BLOCK,
  BUNNY_STATEMENT_BLOCKS,
} from "./blocks";

/**
 * Workspace JSON helpers shared by the client editor, headless server
 * codegen, and grading. Everything here is headless-safe: computeBlockStats
 * and validateWhitelist walk the serialized JSON directly, so untrusted
 * student payloads are inspected without ever instantiating blocks.
 */

/** Toolbox entry shape (matches blockRefSchema in curriculum schemas). */
export interface BlockRef {
  type: string;
  limit?: number;
}

export function workspaceToJson(workspace: Workspace): Record<string, unknown> {
  return Blockly.serialization.workspaces.save(workspace);
}

/**
 * Load workspace JSON into a (headless by default) workspace. Block types
 * must already be registered — call registerBunnyBlocks first.
 */
export function jsonToWorkspace(json: unknown, target?: Workspace): Workspace {
  const workspace = target ?? new Blockly.Workspace();
  Blockly.serialization.workspaces.load(
    (json ?? {}) as Record<string, unknown>,
    workspace,
  );
  return workspace;
}

// ── Serialized-JSON walking (no Blockly involved) ────────────────────────

interface SerializedBlock {
  type?: unknown;
  next?: { block?: SerializedBlock; shadow?: SerializedBlock };
  inputs?: Record<
    string,
    { block?: SerializedBlock; shadow?: SerializedBlock } | undefined
  >;
}

function topBlocksOf(workspaceJson: unknown): SerializedBlock[] {
  if (!workspaceJson || typeof workspaceJson !== "object") return [];
  const blocksSection = (workspaceJson as { blocks?: unknown }).blocks;
  if (!blocksSection || typeof blocksSection !== "object") return [];
  const list = (blocksSection as { blocks?: unknown }).blocks;
  return Array.isArray(list) ? (list as SerializedBlock[]) : [];
}

function visitBlocks(
  block: SerializedBlock | undefined,
  visit: (type: string) => void,
): void {
  if (!block || typeof block !== "object") return;
  if (typeof block.type === "string") visit(block.type);
  if (block.inputs && typeof block.inputs === "object") {
    for (const input of Object.values(block.inputs)) {
      if (!input) continue;
      visitBlocks(input.block, visit);
      visitBlocks(input.shadow, visit);
    }
  }
  visitBlocks(block.next?.block, visit);
  visitBlocks(block.next?.shadow, visit);
}

function countTypes(workspaceJson: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  for (const top of topBlocksOf(workspaceJson)) {
    visitBlocks(top, (type) => {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
  }
  return counts;
}

const STATEMENT_TYPES = new Set<string>(BUNNY_STATEMENT_BLOCKS);

/**
 * Statement blocks only — the hat and sensor value blocks are excluded
 * (engine contract). Disconnected stacks still count: stray blocks in the
 * workspace are part of the student's program size.
 */
export function computeBlockStats(workspaceJson: unknown): BlockStats {
  const countsByType: Record<string, number> = {};
  let totalBlocks = 0;
  for (const [type, count] of countTypes(workspaceJson)) {
    if (!STATEMENT_TYPES.has(type)) continue;
    countsByType[type] = count;
    totalBlocks += count;
  }
  return { totalBlocks, countsByType };
}

/**
 * Server-side defence for untrusted workspace JSON: every block must be the
 * hat or come from the level's toolbox, and per-type instance limits hold.
 * Returns human-readable violation strings; empty array = valid.
 */
export function validateWhitelist(
  workspaceJson: unknown,
  toolbox: BlockRef[],
): string[] {
  const allowed = new Map<string, number | undefined>();
  for (const ref of toolbox) allowed.set(ref.type, ref.limit);

  const violations: string[] = [];
  for (const [type, count] of countTypes(workspaceJson)) {
    if (type === BUNNY_HAT_BLOCK) continue;
    if (!allowed.has(type)) {
      violations.push(`forbidden block "${type}" is not in the level toolbox`);
      continue;
    }
    const limit = allowed.get(type);
    if (limit !== undefined && count > limit) {
      violations.push(
        `block "${type}" used ${count} times, toolbox limit is ${limit}`,
      );
    }
  }
  return violations;
}
