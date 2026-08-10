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

// ── Faded-gap addressing (the Learn step) ────────────────────────────────
//
// A Learn step shows a worked example, then the same program with ONE block
// taken out, and asks the student to put it back (LEARN-STEP-SPEC.md). To
// report WHICH block landed in the gap — rather than merely which block types
// appeared anywhere — the gap is addressed structurally: diff the worked
// example against the faded copy to find the one empty slot, then read the
// student's workspace at exactly that address. A block dropped somewhere else
// therefore reads as "the gap is still empty", which is the truth and the
// right thing to re-prompt on.

/** One step down a serialized program: into a statement/value input, or to
 * the next block in a stack. */
export type SlotStep = { kind: "next" } | { kind: "input"; name: string };

/** Address of a connection, relative to a workspace's top-level block list. */
export interface GapPath {
  topIndex: number;
  steps: SlotStep[];
}

function childAt(
  block: SerializedBlock | undefined,
  step: SlotStep,
): SerializedBlock | undefined {
  if (!block) return undefined;
  if (step.kind === "next") return block.next?.block;
  return block.inputs?.[step.name]?.block;
}

/** Inputs before `next`, so a gap inside a loop's mouth is found before one
 * after the loop — the shape every authored faded program uses. */
function slotsOf(block: SerializedBlock): SlotStep[] {
  const inputs = block.inputs && typeof block.inputs === "object" ? block.inputs : {};
  return [
    ...Object.keys(inputs).map((name) => ({ kind: "input", name }) as SlotStep),
    { kind: "next" } as SlotStep,
  ];
}

function findGapIn(
  full: SerializedBlock,
  faded: SerializedBlock,
  steps: SlotStep[],
): SlotStep[] | null {
  for (const slot of slotsOf(full)) {
    const fullChild = childAt(full, slot);
    if (!fullChild) continue;
    const fadedChild = childAt(faded, slot);
    if (!fadedChild) return [...steps, slot];
    const deeper = findGapIn(fullChild, fadedChild, [...steps, slot]);
    if (deeper) return deeper;
  }
  return null;
}

/**
 * The single connection that `full` fills and `faded` leaves empty, or null
 * when the two programs have no such difference (which the CONCEPT_CARDS
 * payload schema already rejects at authoring time).
 */
export function findFadedGap(full: unknown, faded: unknown): GapPath | null {
  const fullTops = topBlocksOf(full);
  const fadedTops = topBlocksOf(faded);
  for (let index = 0; index < Math.min(fullTops.length, fadedTops.length); index += 1) {
    const steps = findGapIn(fullTops[index]!, fadedTops[index]!, []);
    if (steps) return { topIndex: index, steps };
  }
  return null;
}

/**
 * The type of the block sitting at `path` in a workspace, or null when that
 * connection is empty. Extra top-level stacks are ignored: a block dropped
 * loose on the canvas has not been put in the gap.
 */
export function blockTypeAt(workspaceJson: unknown, path: GapPath): string | null {
  let node: SerializedBlock | undefined = topBlocksOf(workspaceJson)[path.topIndex];
  for (const step of path.steps) {
    if (!node) return null;
    node = childAt(node, step);
  }
  return node && typeof node.type === "string" ? node.type : null;
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
