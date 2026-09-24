import { z } from "zod";

import { parseGrid, type Direction, type GridVariantSpec } from "@/engine";
import { gridVariantSchema, type Check } from "@/modules/curriculum/schemas";

/**
 * Build-your-own maze (CREATIVE_PROJECT, kind MAZE): the child designs the
 * map, then writes the program that solves it. Everything about the DESIGN
 * lives here, shared by the designer (client), the grader (server) and the
 * publish gates, so the checklist a child sees and the rule the server
 * enforces are the same function.
 *
 * A design is an ordinary engine grid variant ({ rows, start }), so once it
 * is accepted the program is graded by the exact pipeline every puzzle uses.
 */

/** Tiles a level may offer on the palette; the goal is always available. */
export type MazePaletteTile = "#" | "W" | "C";

export interface MazeRules {
  board: { width: number; height: number };
  palette: MazePaletteTile[];
  mustInclude: { obstacles: number; carrots: number };
}

export type MazeIssue =
  | { code: "boardSize" }
  | { code: "badTile"; tile: string }
  | { code: "noGoal" }
  | { code: "manyGoals" }
  | { code: "startOutside" }
  | { code: "startBlocked" }
  | { code: "fewObstacles"; have: number; need: number }
  | { code: "fewCarrots"; have: number; need: number }
  | { code: "unreachableGoal" }
  | { code: "unreachableCarrot"; x: number; y: number };

/** Stored draft for a maze level: the design and the program, together. */
export const mazeDraftSchema = z.object({
  design: gridVariantSchema.nullable(),
  workspaceJson: z.unknown(),
});
export type MazeDraft = z.infer<typeof mazeDraftSchema>;

/** A fresh board: Robo Bunny top-left facing East, the burrow bottom-right. */
export function emptyDesign(board: MazeRules["board"]): GridVariantSpec {
  const rows = Array.from({ length: board.height }, () => ".".repeat(board.width));
  const last = board.height - 1;
  rows[last] = `${".".repeat(board.width - 1)}G`;
  return { rows, start: { x: 0, y: 0, dir: "E" } };
}

export const DIRECTIONS: Direction[] = ["N", "E", "S", "W"];

export function nextDirection(dir: Direction): Direction {
  return DIRECTIONS[(DIRECTIONS.indexOf(dir) + 1) % DIRECTIONS.length]!;
}

export function tileAt(design: GridVariantSpec, x: number, y: number): string {
  return design.rows[y]?.[x] ?? ".";
}

/** A copy of the design with one tile replaced (a goal moves: only one). */
export function withTile(
  design: GridVariantSpec,
  x: number,
  y: number,
  tile: string,
): GridVariantSpec {
  const rows = design.rows.map((row, ry) => {
    let chars = row.split("");
    if (tile === "G") chars = chars.map((c) => (c === "G" ? "." : c));
    if (ry === y) chars[x] = tile;
    return chars.join("");
  });
  return { rows, start: design.start };
}

function walkable(rows: string[], x: number, y: number): boolean {
  const tile = rows[y]?.[x];
  return tile !== undefined && tile !== "#" && tile !== "W";
}

/**
 * Every rule a design must meet, in the order the checklist shows them.
 * Empty = ready to build. Shape problems (size, unknown tiles) come first
 * because nothing else is meaningful until they are fixed.
 */
export function analyzeMazeDesign(rules: MazeRules, design: GridVariantSpec): MazeIssue[] {
  const issues: MazeIssue[] = [];
  const { rows, start } = design;
  if (
    rows.length !== rules.board.height ||
    rows.some((row) => row.length !== rules.board.width)
  ) {
    return [{ code: "boardSize" }];
  }
  const allowed = new Set<string>([".", "G", ...rules.palette]);
  for (const row of rows) {
    for (const tile of row) {
      if (!allowed.has(tile)) return [{ code: "badTile", tile }];
    }
  }

  let goals = 0;
  let obstacles = 0;
  let carrots = 0;
  for (const row of rows) {
    for (const tile of row) {
      if (tile === "G") goals += 1;
      else if (tile === "#" || tile === "W") obstacles += 1;
      else if (tile === "C") carrots += 1;
    }
  }
  if (goals === 0) issues.push({ code: "noGoal" });
  if (goals > 1) issues.push({ code: "manyGoals" });
  if (obstacles < rules.mustInclude.obstacles) {
    issues.push({ code: "fewObstacles", have: obstacles, need: rules.mustInclude.obstacles });
  }
  if (carrots < rules.mustInclude.carrots) {
    issues.push({ code: "fewCarrots", have: carrots, need: rules.mustInclude.carrots });
  }

  if (start.x < 0 || start.y < 0 || start.x >= rules.board.width || start.y >= rules.board.height) {
    issues.push({ code: "startOutside" });
    return issues;
  }
  if (!walkable(rows, start.x, start.y)) {
    issues.push({ code: "startBlocked" });
    return issues;
  }

  // BFS from the start over non-fatal tiles (the same rule as the publish
  // reachability gate): the goal and every carrot must be reachable.
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue = [{ x: start.x, y: start.y }];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !walkable(rows, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  const grid = parseGrid(rows);
  let goalReachable = goals === 0;
  grid.tiles.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (tile === "G" && seen.has(`${x},${y}`)) goalReachable = true;
    }),
  );
  if (!goalReachable) issues.push({ code: "unreachableGoal" });
  for (const carrot of grid.collectables) {
    if (!seen.has(`${carrot.x},${carrot.y}`)) {
      issues.push({ code: "unreachableCarrot", x: carrot.x, y: carrot.y });
    }
  }
  return issues;
}

/** The parts of a maze payload the generated grid level needs. */
export interface MazeProgramRules {
  toolbox: { type: string; limit?: number }[];
  budgets: { maxCommands: number };
  starCriteria: { threeStarMaxBlocks?: number };
}

/**
 * The child's design as a one-variant BLOCK_CODING payload: reach the
 * burrow (core), and pick up every carrot they placed (secondary). Carrots
 * collect on entry, as in the Workbench levels before this.
 */
export function mazeGridPayload(rules: MazeProgramRules, design: GridVariantSpec) {
  const hasCarrots = design.rows.some((row) => row.includes("C"));
  const checks: Check[] = [{ id: "reachedGoal", severity: "core" }];
  if (hasCarrots) checks.push({ id: "collectedAll", severity: "secondary" });
  return {
    toolbox: rules.toolbox,
    variants: [design],
    autoCollect: true,
    nonFatalBumps: false,
    budgets: rules.budgets,
    checks,
    starCriteria: rules.starCriteria,
  };
}
