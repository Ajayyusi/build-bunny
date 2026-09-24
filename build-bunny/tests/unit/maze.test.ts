import { describe, expect, it } from "vitest";

import {
  analyzeMazeDesign,
  emptyDesign,
  mazeGridPayload,
  nextDirection,
  withTile,
  type MazeRules,
} from "@/modules/activities/maze";
import { creativeProjectPayload, validatePayload } from "@/modules/curriculum/schemas";

/**
 * Build-your-own maze: the design rules the child sees as a checklist are
 * the rules the server enforces (one function), and an accepted design
 * becomes an ordinary one-variant grid level.
 */

const RULES: MazeRules = {
  board: { width: 5, height: 4 },
  palette: ["#", "W", "C"],
  mustInclude: { obstacles: 2, carrots: 1 },
};

describe("emptyDesign / withTile", () => {
  it("starts with Robo Bunny top-left facing East and the burrow bottom-right", () => {
    const design = emptyDesign(RULES.board);
    expect(design.rows).toEqual([".....", ".....", ".....", "....G"]);
    expect(design.start).toEqual({ x: 0, y: 0, dir: "E" });
  });

  it("moves the single burrow when a new one is painted", () => {
    const design = withTile(emptyDesign(RULES.board), 2, 1, "G");
    expect(design.rows).toEqual([".....", "..G..", ".....", "....."]);
  });

  it("turns clockwise", () => {
    expect(["N", "E", "S", "W"].map((d) => nextDirection(d as "N"))).toEqual(["E", "S", "W", "N"]);
  });
});

describe("analyzeMazeDesign", () => {
  it("lists what the checklist still needs, in checklist order", () => {
    expect(analyzeMazeDesign(RULES, emptyDesign(RULES.board))).toEqual([
      { code: "fewObstacles", have: 0, need: 2 },
      { code: "fewCarrots", have: 0, need: 1 },
    ]);
  });

  it("accepts a design that meets every rule", () => {
    const design = { rows: [".#...", ".#C..", ".....", "....G"], start: { x: 0, y: 0, dir: "E" as const } };
    expect(analyzeMazeDesign(RULES, design)).toEqual([]);
  });

  it("refuses a walled-off burrow or carrot, a blocked start, and a missing goal", () => {
    const walled = { rows: [".#.#.", ".#C#.", "...#.", "...#G"], start: { x: 0, y: 0, dir: "E" as const } };
    expect(analyzeMazeDesign(RULES, walled)).toEqual([{ code: "unreachableGoal" }]);
    const carrot = { rows: ["..#C#", "..###", ".....", "....G"], start: { x: 0, y: 0, dir: "E" as const } };
    expect(analyzeMazeDesign(RULES, carrot)).toEqual([{ code: "unreachableCarrot", x: 3, y: 0 }]);
    const blocked = { rows: ["##C..", ".....", ".....", "....G"], start: { x: 0, y: 0, dir: "E" as const } };
    expect(analyzeMazeDesign(RULES, blocked)).toEqual([{ code: "startBlocked" }]);
    const noGoal = { rows: ["##C..", ".....", ".....", "....."], start: { x: 2, y: 1, dir: "E" as const } };
    expect(analyzeMazeDesign(RULES, noGoal).map((i) => i.code)).toEqual(["noGoal"]);
  });

  it("refuses the wrong board size or a tile the palette does not offer", () => {
    expect(analyzeMazeDesign(RULES, { rows: ["...", "..G"], start: { x: 0, y: 0, dir: "E" } })).toEqual([
      { code: "boardSize" },
    ]);
    const rules: MazeRules = { ...RULES, palette: ["#"], mustInclude: { obstacles: 0, carrots: 0 } };
    expect(analyzeMazeDesign(rules, { rows: ["W....", ".....", ".....", "....G"], start: { x: 1, y: 0, dir: "E" } })).toEqual([
      { code: "badTile", tile: "W" },
    ]);
  });
});

describe("mazeGridPayload", () => {
  const program = { toolbox: [{ type: "bb_moveForward" }], budgets: { maxCommands: 1000 }, starCriteria: { threeStarMaxBlocks: 6 } };

  it("asks for the burrow, and for every carrot only when the child placed some", () => {
    const plain = mazeGridPayload(program, emptyDesign(RULES.board));
    expect(plain.checks).toEqual([{ id: "reachedGoal", severity: "core" }]);
    expect(plain.variants).toHaveLength(1);
    expect(plain.autoCollect).toBe(true);
    const withCarrot = mazeGridPayload(program, withTile(emptyDesign(RULES.board), 1, 0, "C"));
    expect(withCarrot.checks.map((c) => c.id)).toEqual(["reachedGoal", "collectedAll"]);
  });
});

describe("creativeProjectPayload", () => {
  const base = {
    kind: "MAZE",
    board: { width: 5, height: 4 },
    palette: ["#", "C"],
    mustInclude: { obstacles: 1, carrots: 1 },
    toolbox: [{ type: "bb_moveForward" }],
    starCriteria: { threeStarMaxBlocks: 6 },
    sample: {
      design: { rows: [".#...", "..C..", ".....", "....G"], start: { x: 0, y: 0, dir: "E" } },
      solution: {},
    },
  };

  it("validates a maze level and rejects rules the palette cannot meet", () => {
    expect(validatePayload("CREATIVE_PROJECT", base).ok).toBe(true);
    const noCarrots = { ...base, palette: ["#"] };
    expect(creativeProjectPayload.safeParse(noCarrots).success).toBe(false);
    const wrongSample = { ...base, sample: { ...base.sample, design: { rows: ["...", "..G"], start: { x: 0, y: 0, dir: "E" } } } };
    expect(creativeProjectPayload.safeParse(wrongSample).success).toBe(false);
  });
});
