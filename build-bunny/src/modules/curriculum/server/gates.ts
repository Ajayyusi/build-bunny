import "server-only";

import { parseGrid, type ParsedGrid } from "@/engine";
import {
  blockCodingPayload,
  debuggingPayload,
} from "@/modules/curriculum/schemas";
import { gradeWorkspace } from "@/modules/grading/server/grade";
import type { GateResult, LevelSnapshot } from "./publish";

/**
 * Engine-backed publish gates (m3 wave 3 — the M2 stubs made real). Both
 * gates prove properties of the CONTENT, not the student: the recorded
 * author solution must earn a perfect run through the exact grading pipeline
 * students face, and every tile the checks care about must be physically
 * reachable. A level that cannot be beaten flawlessly by its own author has
 * no business being published.
 */

/** Grid-world activity types — the only ones these gates apply to. */
const GRID_ACTIVITY_TYPES = new Set(["BLOCK_CODING", "DEBUGGING"]);

function pass(gate: string): GateResult {
  return { gate, ok: true, issues: [] };
}

function fail(gate: string, issues: string[]): GateResult {
  return { gate, ok: false, issues };
}

function skipped(gate: string, reason: string): GateResult {
  return { gate, ok: true, skipped: true, reason, issues: [] };
}

type GridPayload =
  | ReturnType<typeof blockCodingPayload.parse>
  | ReturnType<typeof debuggingPayload.parse>;

function parseGridPayload(snapshot: LevelSnapshot): GridPayload | null {
  const schema =
    snapshot.activityType === "DEBUGGING" ? debuggingPayload : blockCodingPayload;
  const parsed = schema.safeParse(snapshot.payload);
  return parsed.success ? parsed.data : null;
}

/**
 * solutionRuns: the recorded payload.solution, regenerated through the
 * server Blockly codegen with the level's own toolbox, must PASS every
 * variant with 3 stars (hints ignored — the author gets no hint cap).
 */
export function gateSolutionRuns(snapshot: LevelSnapshot): GateResult {
  const gate = "solutionRuns";
  if (!GRID_ACTIVITY_TYPES.has(snapshot.activityType)) {
    return skipped(gate, `not applicable to ${snapshot.activityType}`);
  }
  const payload = parseGridPayload(snapshot);
  if (!payload) {
    return fail(gate, ["payload does not validate — fix payloadValid first"]);
  }
  if (payload.solution === undefined || payload.solution === null) {
    return fail(gate, ["payload.solution (recorded author solution) is required"]);
  }

  const outcome = gradeWorkspace(snapshot, payload.solution);
  if (outcome.verdict === "PASS" && outcome.stars === 3) return pass(gate);

  const issues: string[] = [
    `solution graded ${outcome.verdict} with ${outcome.stars} star(s) — expected PASS with 3`,
  ];
  outcome.perVariant.forEach((variant, index) => {
    for (const failure of variant.checkFailures) {
      issues.push(
        `variant ${index + 1}: ${failure.id} failed (${failure.code}` +
          `${failure.data ? ` ${JSON.stringify(failure.data)}` : ""})`,
      );
    }
    if (variant.termination !== "COMPLETED") {
      issues.push(`variant ${index + 1}: run terminated ${variant.termination}`);
    }
  });
  if (outcome.verdict === "ERROR" && outcome.primaryFeedback) {
    issues.push(
      `grading error: ${outcome.primaryFeedback.code}` +
        `${outcome.primaryFeedback.data ? ` ${JSON.stringify(outcome.primaryFeedback.data)}` : ""}`,
    );
  }
  return fail(gate, issues);
}

/** Tiles a bunny can stand on — bumps ("#") and water ("W") are fatal. */
function walkable(grid: ParsedGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
  const tile = grid.tiles[y]?.[x];
  return tile !== undefined && tile !== "#" && tile !== "W";
}

/**
 * reachability: BFS from the start pose over non-fatal tiles must reach a
 * goal AND every collectable, on every variant — no authored level may ask
 * for a physically impossible run. Grids may carry several "G" tiles with
 * some deliberately walled off (e.g. choose-the-path's two doors, one
 * blocked per variant): the engine treats ANY "G" as the goal, so one
 * reachable goal is what the gate requires.
 */
export function gateReachability(snapshot: LevelSnapshot): GateResult {
  const gate = "reachability";
  if (!GRID_ACTIVITY_TYPES.has(snapshot.activityType)) {
    return skipped(gate, `not applicable to ${snapshot.activityType}`);
  }
  const payload = parseGridPayload(snapshot);
  if (!payload) {
    return fail(gate, ["payload does not validate — fix payloadValid first"]);
  }

  const issues: string[] = [];
  payload.variants.forEach((variant, index) => {
    const label = `variant ${index + 1}`;
    const grid = parseGrid(variant.rows);
    // parseGrid keeps only the LAST goal — collect every "G" ourselves.
    const goals: Array<{ x: number; y: number }> = [];
    grid.tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        if (tile === "G") goals.push({ x, y });
      }),
    );
    if (goals.length === 0) {
      issues.push(`${label}: grid has no goal ("G") tile`);
      return;
    }
    if (!walkable(grid, variant.start.x, variant.start.y)) {
      issues.push(`${label}: start tile (${variant.start.x},${variant.start.y}) is not walkable`);
      return;
    }

    const seen = new Set<string>([`${variant.start.x},${variant.start.y}`]);
    const queue: Array<{ x: number; y: number }> = [
      { x: variant.start.x, y: variant.start.y },
    ];
    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || !walkable(grid, nx, ny)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }

    if (!goals.some((goal) => seen.has(`${goal.x},${goal.y}`))) {
      issues.push(`${label}: no goal ("G") tile is reachable from start`);
    }
    for (const carrot of grid.collectables) {
      if (!seen.has(`${carrot.x},${carrot.y}`)) {
        issues.push(`${label}: collectable at (${carrot.x},${carrot.y}) is unreachable from start`);
      }
    }
  });

  return issues.length === 0 ? pass(gate) : fail(gate, issues);
}
