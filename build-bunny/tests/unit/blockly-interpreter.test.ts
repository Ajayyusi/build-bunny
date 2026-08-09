import { describe, expect, it } from "vitest";
import type { GridVariantSpec, EngineConfig } from "@/engine";
import { registerBunnyBlocks } from "@/modules/blockly/blocks";
import {
  INTERPRETER_STEP_BUDGET,
  runProgram,
  runProgramAllVariants,
} from "@/modules/blockly/interpreter";
import { generateRunnableCode } from "@/modules/blockly/server/codegen";
import type { BlockRef } from "@/modules/blockly/serialization";
import { bundle } from "../../content";
import type { LevelFixture } from "@/modules/curriculum/schemas";

/**
 * js-interpreter hosting against the real engine Simulation: generated
 * fixture programs animate the grid, fatal events halt, and the interpreter
 * step budget breaks command-free infinite loops.
 */

registerBunnyBlocks("en");

const DEFAULT_CONFIG: EngineConfig = {
  autoCollect: true,
  nonFatalBumps: false,
  maxCommands: 1000,
};

interface BlockCodingPayloadShape {
  toolbox: BlockRef[];
  solution?: unknown;
  variants: GridVariantSpec[];
  autoCollect?: boolean;
  nonFatalBumps?: boolean;
  budgets?: { maxCommands?: number };
}

function levelPayload(slug: string): BlockCodingPayloadShape {
  for (const world of bundle.worlds) {
    for (const worldModule of world.modules) {
      const level: LevelFixture | undefined = worldModule.levels.find(
        (l) => l.slug === slug,
      );
      if (level) return level.payload as BlockCodingPayloadShape;
    }
  }
  throw new Error(`fixture level ${slug} not found`);
}

describe("runProgram", () => {
  it("runs the repeat-after-me solution: 4 moves onto the goal + highlight log", () => {
    const payload = levelPayload("repeat-after-me");
    const { code } = generateRunnableCode(payload.solution, payload.toolbox);
    const run = runProgram(code, payload.variants[0]!, DEFAULT_CONFIG);

    expect(run.termination).toBe("COMPLETED");
    expect(run.reachedGoal).toBe(true);
    expect(run.commandCount).toBe(4);
    const moves = run.events.filter((e) => e.type === "move");
    expect(moves).toHaveLength(4);
    expect(run.finalPose).toEqual({ x: 4, y: 1, dir: "E" });
    expect(run.events.at(-1)).toEqual({ type: "goal", step: 4 });

    // Highlight log: the loop lights up once, the move once per iteration.
    expect(run.highlights.map((h) => h.blockId)).toEqual([
      "r1",
      "m1",
      "m1",
      "m1",
      "m1",
    ]);
    expect(run.highlights.map((h) => h.step)).toEqual([1, 1, 2, 3, 4]);
  });

  it("breaks a command-free infinite while via the interpreter step budget", () => {
    const run = runProgram(
      "while (!onGoal()) {}",
      { rows: ["..G"], start: { x: 0, y: 0, dir: "E" } },
      DEFAULT_CONFIG,
    );
    expect(run.termination).toBe("RUNTIME_ERROR");
    expect(run.events.at(-1)?.type).toBe("budgetExceeded");
    expect(run.commandCount).toBe(0);
    expect(INTERPRETER_STEP_BUDGET).toBe(100_000);
  });

  it("halts as BUMPED when the program drives into a rock", () => {
    const run = runProgram(
      "highlight('m1');\nmoveForward();\nhighlight('m2');\nmoveForward();\n",
      { rows: [".#."], start: { x: 0, y: 0, dir: "E" } },
      DEFAULT_CONFIG,
    );
    expect(run.termination).toBe("BUMPED");
    expect(run.reachedGoal).toBe(false);
    // The fatal command still counts; the second move never runs.
    expect(run.commandCount).toBe(1);
    expect(run.events.at(-1)).toEqual({ type: "bump", x: 1, y: 0, step: 1 });
    expect(run.highlights.map((h) => h.blockId)).toEqual(["m1"]);
  });

  it("exceeding the engine command budget terminates BUDGET_EXCEEDED", () => {
    const run = runProgram(
      "while (!onGoal()) { moveForward(); turnLeft(); turnLeft(); }",
      { rows: ["..G"], start: { x: 0, y: 0, dir: "E" } },
      { ...DEFAULT_CONFIG, maxCommands: 25 },
    );
    expect(run.termination).toBe("BUDGET_EXCEEDED");
    expect(run.events.at(-1)?.type).toBe("budgetExceeded");
  });

  it("say output is captured", () => {
    const run = runProgram(
      'say("hop hop");\n',
      { rows: ["G"], start: { x: 0, y: 0, dir: "E" } },
      DEFAULT_CONFIG,
    );
    expect(run.sayOutputs).toEqual(["hop hop"]);
    expect(run.termination).toBe("COMPLETED");
    expect(run.reachedGoal).toBe(true);
  });

  it("treats a syntax error in generated code as RUNTIME_ERROR", () => {
    const run = runProgram(
      "for (var {{{",
      { rows: ["G"], start: { x: 0, y: 0, dir: "E" } },
      DEFAULT_CONFIG,
    );
    expect(run.termination).toBe("RUNTIME_ERROR");
  });
});

describe("runProgramAllVariants", () => {
  it("the choose-the-path solution beats BOTH maps with one program", () => {
    const payload = levelPayload("choose-the-path");
    const { code } = generateRunnableCode(payload.solution, payload.toolbox);
    const runs = runProgramAllVariants(code, payload);

    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(run.termination).toBe("COMPLETED");
      expect(run.reachedGoal).toBe(true);
    }
    // Variant A (north door blocked) turns around; variant B walks straight
    // through — the sensor makes the SAME program take different paths.
    expect(runs[0]!.finalPose.dir).not.toBe(runs[1]!.finalPose.dir);
  });

  it("the forest-challenge capstone solves both spirals and collects everything", () => {
    const payload = levelPayload("forest-challenge");
    const { code } = generateRunnableCode(payload.solution, payload.toolbox);
    const runs = runProgramAllVariants(code, payload);

    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(run.termination).toBe("COMPLETED");
      expect(run.reachedGoal).toBe(true);
      expect(run.collected).toBe(run.totalCollectables);
    }
  });

  it("every authored Worlds 1–2 solution passes its own level end-to-end", () => {
    for (const world of bundle.worlds) {
      for (const worldModule of world.modules) {
        for (const level of worldModule.levels) {
          if (
            level.activityType !== "BLOCK_CODING" &&
            level.activityType !== "DEBUGGING"
          ) {
            continue;
          }
          const payload = level.payload as BlockCodingPayloadShape;
          const { code } = generateRunnableCode(
            payload.solution,
            payload.toolbox,
          );
          const runs = runProgramAllVariants(code, payload);
          for (const [index, run] of runs.entries()) {
            expect(
              run.reachedGoal,
              `${level.slug} variant ${index} reaches the goal`,
            ).toBe(true);
            expect(
              run.collected,
              `${level.slug} variant ${index} collects everything`,
            ).toBe(run.totalCollectables);
          }
        }
      }
    }
  });
});
