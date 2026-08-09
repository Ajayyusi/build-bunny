import type { Direction } from "./types";

/**
 * Grid parsing + direction math for the bunny grid world. Kept separate from
 * the simulation so grading utilities (reachability BFS in the publish gates)
 * can reuse the parsed form without instantiating a Simulation.
 */

export type TileChar = "." | "#" | "C" | "G" | "W";

export interface GridPosition {
  x: number;
  y: number;
}

export interface ParsedGrid {
  width: number;
  height: number;
  /** tiles[y][x] — row 0 is the top row, matching the authored rows. */
  tiles: TileChar[][];
  collectables: GridPosition[];
  goal: GridPosition | null;
}

const LEGAL_TILES = new Set<string>([".", "#", "C", "G", "W"]);

/**
 * Parse ".#CGW" rows into tiles + collectable positions + goal. Content is
 * zod-validated upstream (gridVariantSchema), so malformed input here is an
 * authoring-pipeline bug — fail loudly rather than guess.
 */
export function parseGrid(rows: string[]): ParsedGrid {
  const firstRow = rows[0];
  if (firstRow === undefined) throw new Error("parseGrid: grid has no rows");
  const width = firstRow.length;
  if (width === 0) throw new Error("parseGrid: grid rows are empty");

  const tiles: TileChar[][] = [];
  const collectables: GridPosition[] = [];
  let goal: GridPosition | null = null;

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`parseGrid: row ${y} width ${row.length} !== ${width}`);
    }
    const tileRow: TileChar[] = [];
    Array.from(row).forEach((ch, x) => {
      if (!LEGAL_TILES.has(ch)) {
        throw new Error(`parseGrid: illegal tile "${ch}" at (${x},${y})`);
      }
      tileRow.push(ch as TileChar);
      if (ch === "C") collectables.push({ x, y });
      if (ch === "G") goal = { x, y };
    });
    tiles.push(tileRow);
  });

  return { width, height: rows.length, tiles, collectables, goal };
}

/** Screen-style axes: y grows downward, so N is y-1. */
export const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};

export const TURN_LEFT: Record<Direction, Direction> = {
  N: "W",
  W: "S",
  S: "E",
  E: "N",
};

export const TURN_RIGHT: Record<Direction, Direction> = {
  N: "E",
  E: "S",
  S: "W",
  W: "N",
};
