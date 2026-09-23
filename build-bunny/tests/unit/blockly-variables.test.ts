import { describe, expect, it } from "vitest";

import { evaluateChecks, type Check } from "@/engine";
import { registerBunnyBlocks } from "@/modules/blockly/blocks";
import { buildDisplayGenerator, buildRunnableGenerator } from "@/modules/blockly/codegen";
import { runProgram } from "@/modules/blockly/interpreter";
import {
  computeBlockStats,
  jsonToWorkspace,
  missingTrick,
  programBlocks,
  programShape,
} from "@/modules/blockly/serialization";
import { generateRunnableCode } from "@/modules/blockly/server/codegen";

/**
 * Variables ("the counter") and functions ("my trick") — the two ideas Code
 * City's expansion adds to the bunny language. Real code is generated,
 * really run through js-interpreter, and the run reports the variable back
 * so the variableEquals check can grade it.
 */

registerBunnyBlocks("en");

const CONFIG = { autoCollect: true, nonFatalBumps: false, maxCommands: 1000 };

type Node = Record<string, unknown>;
function chain(...blocks: Node[]): Node | undefined {
  let next: Node | undefined;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = { ...blocks[i] };
    if (next) block["next"] = { block: next };
    next = block;
  }
  return next;
}
function workspace(main: Node[], extraTops: Node[] = []): unknown {
  const first = chain(...main);
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        { type: "bb_whenStart", id: "start", ...(first ? { next: { block: first } } : {}) },
        ...extraTops,
      ],
    },
  };
}

function display(json: unknown): string {
  const ws = jsonToWorkspace(json);
  try {
    return buildDisplayGenerator().workspaceToCode(ws);
  } finally {
    ws.dispose();
  }
}
function runnable(json: unknown): string {
  const ws = jsonToWorkspace(json);
  try {
    return buildRunnableGenerator().workspaceToCode(ws);
  } finally {
    ws.dispose();
  }
}

const COUNTER_PROGRAM = workspace([
  { type: "bb_setCounter", id: "s1", fields: { VALUE: 2 } },
  { type: "bb_moveForward", id: "m1" },
  { type: "bb_changeCounter", id: "c1", fields: { DELTA: 1 } },
  { type: "bb_moveForward", id: "m2" },
  { type: "bb_changeCounter", id: "c2", fields: { DELTA: 1 } },
  { type: "bb_sayCounter", id: "say1" },
]);

const TRICK = {
  type: "bb_defineTrick",
  id: "def1",
  x: 300,
  y: 24,
  inputs: {
    DO: { block: chain({ type: "bb_moveForward", id: "tm1" }, { type: "bb_turnRight", id: "tt1" }) },
  },
};
const TRICK_PROGRAM = workspace(
  [
    { type: "bb_doTrick", id: "d1" },
    { type: "bb_doTrick", id: "d2" },
    { type: "bb_doTrick", id: "d3" },
    { type: "bb_doTrick", id: "d4" },
  ],
  [TRICK],
);

describe("the counter — code generation", () => {
  it("declares the counter once, above the program, in the display code", () => {
    expect(display(COUNTER_PROGRAM)).toBe(
      [
        "var counter = 0;",
        "counter = 2;",
        "moveForward();",
        "counter = counter + 1;",
        "moveForward();",
        "counter = counter + 1;",
        "say(String(counter));",
        "",
      ].join("\n"),
    );
  });

  it("does not declare a counter a program never uses", () => {
    expect(display(workspace([{ type: "bb_moveForward", id: "m1" }]))).toBe("moveForward();\n");
  });

  it("highlights every counter block in the runnable code", () => {
    const code = runnable(COUNTER_PROGRAM);
    expect(code.startsWith("var counter = 0;\nhighlight('s1');\ncounter = 2;\n")).toBe(true);
    expect(code).toContain("highlight('say1');\nsay(String(counter));\n");
  });
});

describe("the counter — running and grading", () => {
  const variant = { rows: ["...G", "...."], start: { x: 0, y: 0, dir: "E" as const } };

  it("reports the counter's final value and what the bunny said", () => {
    const run = runProgram(runnable(COUNTER_PROGRAM), variant, CONFIG);
    expect(run.termination).toBe("COMPLETED");
    expect(run.variables).toEqual({ counter: 4 });
    expect(run.sayOutputs).toEqual(["4"]);
    expect(run.commandCount).toBe(3); // two hops + one say
  });

  it("reports no variables for a program without any", () => {
    const run = runProgram("moveForward();\n", variant, CONFIG);
    expect(run.variables).toBeUndefined();
  });

  it("variableEquals passes on the right value and locates the wrong one", () => {
    const run = runProgram(runnable(COUNTER_PROGRAM), variant, CONFIG);
    const stats = computeBlockStats(COUNTER_PROGRAM);
    const check = (value: number): Check => ({
      id: "variableEquals",
      severity: "core",
      params: { name: "counter", value },
    });
    expect(evaluateChecks([check(4)], run, stats)).toEqual([]);
    expect(evaluateChecks([check(3)], run, stats)).toEqual([
      {
        id: "variableEquals",
        severity: "core",
        code: "wrongVariable",
        data: { name: "counter", expected: 3, actual: 4 },
      },
    ]);
    // A program with no counter at all: "nothing", not a crash.
    const plain = runProgram("moveForward();\n", variant, CONFIG);
    expect(evaluateChecks([check(1)], plain, stats)[0]?.data).toEqual({
      name: "counter",
      expected: 1,
      actual: null,
    });
  });

  it("counts counter and trick blocks in block stats, like any statement", () => {
    expect(computeBlockStats(COUNTER_PROGRAM).totalBlocks).toBe(6);
    expect(computeBlockStats(TRICK_PROGRAM).countsByType).toEqual({
      bb_doTrick: 4,
      bb_defineTrick: 1,
      bb_moveForward: 1,
      bb_turnRight: 1,
    });
  });
});

describe("my trick — code generation and running", () => {
  it("hoists the trick definition above the program", () => {
    expect(display(TRICK_PROGRAM)).toBe(
      [
        "function myTrick() {",
        "  moveForward();",
        "  turnRight();",
        "}",
        "myTrick();",
        "myTrick();",
        "myTrick();",
        "myTrick();",
        "",
      ].join("\n"),
    );
  });

  it("runs the trick's body each time it is called, highlighting the body's blocks", () => {
    // Four (hop, turn right) tricks walk a square back to the start.
    const run = runProgram(
      runnable(TRICK_PROGRAM),
      { rows: ["G..", "...", "..."], start: { x: 0, y: 0, dir: "E" } },
      CONFIG,
    );
    expect(run.termination).toBe("COMPLETED");
    expect(run.commandCount).toBe(8);
    expect(run.finalPose).toEqual({ x: 0, y: 0, dir: "E" });
    expect(run.reachedGoal).toBe(true);
    // The definition block itself is never highlighted; its body is, per call.
    const ids = run.highlights.map((h) => h.blockId);
    expect(ids).not.toContain("def1");
    expect(ids.filter((id) => id === "tm1")).toHaveLength(4);
    expect(ids.slice(0, 3)).toEqual(["d1", "tm1", "tt1"]);
  });

  it("'do my trick' with no trick taught runs an empty trick instead of crashing", () => {
    const orphan = workspace([{ type: "bb_doTrick", id: "d1" }, { type: "bb_moveForward", id: "m1" }]);
    expect(display(orphan)).toBe("function myTrick() {\n}\nmyTrick();\nmoveForward();\n");
    const run = runProgram(runnable(orphan), { rows: [".G", ".."], start: { x: 0, y: 0, dir: "E" } }, CONFIG);
    expect(run.termination).toBe("COMPLETED");
    expect(run.reachedGoal).toBe(true);
    // …and the player is told before running.
    expect(missingTrick(orphan)).toBe(true);
    expect(missingTrick(TRICK_PROGRAM)).toBe(false);
    expect(missingTrick(COUNTER_PROGRAM)).toBe(false);
  });

  it("passes the server whitelist when the toolbox offers the blocks", () => {
    const toolbox = [{ type: "bb_doTrick" }, { type: "bb_defineTrick", limit: 1 }, { type: "bb_moveForward" }, { type: "bb_turnRight" }];
    const { code, blockStats } = generateRunnableCode(TRICK_PROGRAM, toolbox);
    expect(code).toContain("function myTrick() {");
    expect(blockStats.totalBlocks).toBe(7);
    expect(() => generateRunnableCode(TRICK_PROGRAM, [{ type: "bb_doTrick" }])).toThrow(/bb_defineTrick/);
  });
});

describe("program shape with a trick on the canvas", () => {
  it("treats the definition as scaffolding, not loose blocks, and numbers its body after the program", () => {
    expect(programShape(TRICK_PROGRAM)).toEqual({ attached: 4, loose: 0 });
    // A trick taught but nothing under "when start" is still an empty program.
    expect(programShape(workspace([], [TRICK]))).toEqual({ attached: 0, loose: 0 });
    expect(programBlocks(TRICK_PROGRAM)).toEqual([
      { id: "d1", type: "bb_doTrick", index: 1 },
      { id: "d2", type: "bb_doTrick", index: 2 },
      { id: "d3", type: "bb_doTrick", index: 3 },
      { id: "d4", type: "bb_doTrick", index: 4 },
      { id: "tm1", type: "bb_moveForward", index: 5 },
      { id: "tt1", type: "bb_turnRight", index: 6 },
    ]);
  });
});
