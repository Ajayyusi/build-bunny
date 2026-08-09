import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  EngineHalt,
  ENGINE_VERSION,
  Simulation,
  parseGrid,
  type EngineCommand,
  type EngineConfig,
  type GridVariantSpec,
  type RunResult,
} from "@/engine";

/**
 * The pure grid-world simulation (M3 wave 1). Semantics under test are the
 * adjudicated ones from m3-contracts: end-state goal, auto vs explicit
 * collect, fatal bump/splash/budget, budget-free sensors, determinism.
 */

const DEFAULT_CONFIG: EngineConfig = {
  autoCollect: true,
  nonFatalBumps: false,
  maxCommands: 1000,
};

/** Runs a command script the way the interpreter host will: halt → finish. */
function run(
  variant: GridVariantSpec,
  commands: EngineCommand[],
  config: Partial<EngineConfig> = {},
): RunResult {
  const sim = new Simulation(variant, { ...DEFAULT_CONFIG, ...config });
  try {
    for (const cmd of commands) sim.execute(cmd);
    return sim.finish();
  } catch (err) {
    if (err instanceof EngineHalt) return sim.finish(err.termination);
    throw err;
  }
}

const move: EngineCommand = { type: "moveForward" };
const left: EngineCommand = { type: "turnLeft" };
const right: EngineCommand = { type: "turnRight" };
const collect: EngineCommand = { type: "collect" };

/** 3×3 open meadow, start centered. */
const open = (dir: "N" | "E" | "S" | "W"): GridVariantSpec => ({
  rows: ["...", "...", "..."],
  start: { x: 1, y: 1, dir },
});

describe("parseGrid", () => {
  it("extracts tiles, collectables, and the goal", () => {
    const grid = parseGrid([".C.", "#W.", "..G"]);
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(3);
    expect(grid.tiles[1]?.[0]).toBe("#");
    expect(grid.tiles[1]?.[1]).toBe("W");
    expect(grid.collectables).toEqual([{ x: 1, y: 0 }]);
    expect(grid.goal).toEqual({ x: 2, y: 2 });
  });

  it("returns a null goal for goalless grids", () => {
    expect(parseGrid(["..", ".."]).goal).toBeNull();
  });

  it("rejects ragged rows and illegal tiles", () => {
    expect(() => parseGrid(["..", "..."])).toThrow(/width/);
    expect(() => parseGrid(["..", ".X"])).toThrow(/illegal tile/);
    expect(() => parseGrid([])).toThrow(/no rows/);
  });
});

describe("movement and turn math", () => {
  it.each([
    ["N", { x: 1, y: 0 }],
    ["E", { x: 2, y: 1 }],
    ["S", { x: 1, y: 2 }],
    ["W", { x: 0, y: 1 }],
  ] as const)("moveForward facing %s", (dir, to) => {
    const result = run(open(dir), [move]);
    expect(result.finalPose).toEqual({ ...to, dir });
    expect(result.events).toContainEqual({
      type: "move",
      from: { x: 1, y: 1, dir },
      to: { ...to, dir },
      step: 1,
    });
    expect(result.termination).toBe("COMPLETED");
  });

  it("turnLeft cycles N → W → S → E → N", () => {
    const sim = new Simulation(open("N"), DEFAULT_CONFIG);
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      sim.execute(left);
      seen.push(sim.finish().finalPose.dir);
    }
    expect(seen).toEqual(["W", "S", "E", "N"]);
  });

  it("turnRight cycles N → E → S → W → N", () => {
    const sim = new Simulation(open("N"), DEFAULT_CONFIG);
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      sim.execute(right);
      seen.push(sim.finish().finalPose.dir);
    }
    expect(seen).toEqual(["E", "S", "W", "N"]);
  });

  it("turns never change position and emit turn events with the new pose", () => {
    const result = run(open("N"), [left, right, right]);
    expect(result.finalPose).toEqual({ x: 1, y: 1, dir: "E" });
    expect(result.events.filter((e) => e.type === "turn")).toEqual([
      { type: "turn", dir: "left", pose: { x: 1, y: 1, dir: "W" }, step: 1 },
      { type: "turn", dir: "right", pose: { x: 1, y: 1, dir: "N" }, step: 2 },
      { type: "turn", dir: "right", pose: { x: 1, y: 1, dir: "E" }, step: 3 },
    ]);
  });
});

describe("fatal events", () => {
  it("halts on grid-edge bump with the off-grid target and step", () => {
    const variant: GridVariantSpec = { rows: ["..", ".."], start: { x: 0, y: 0, dir: "N" } };
    const sim = new Simulation(variant, DEFAULT_CONFIG);
    sim.execute(right); // step 1: face E, harmless
    sim.execute(left); // step 2: back to N
    expect(() => sim.execute(move)).toThrow(EngineHalt);

    const result = sim.finish("BUMPED");
    expect(result.termination).toBe("BUMPED");
    expect(result.reachedGoal).toBe(false);
    expect(result.finalPose).toEqual({ x: 0, y: 0, dir: "N" });
    expect(result.events.at(-1)).toEqual({ type: "bump", x: 0, y: -1, step: 3 });
  });

  it("halts on rock bump without moving", () => {
    const result = run({ rows: ["#..", "..."], start: { x: 1, y: 0, dir: "W" } }, [move]);
    expect(result.termination).toBe("BUMPED");
    expect(result.finalPose).toEqual({ x: 1, y: 0, dir: "W" });
    expect(result.events.at(-1)).toEqual({ type: "bump", x: 0, y: 0, step: 1 });
    expect(result.events.some((e) => e.type === "move")).toBe(false);
  });

  it("rejects further commands after a halt", () => {
    const sim = new Simulation({ rows: ["#..", "..."], start: { x: 1, y: 0, dir: "W" } }, DEFAULT_CONFIG);
    expect(() => sim.execute(move)).toThrow(EngineHalt);
    expect(() => sim.execute(left)).toThrow(EngineHalt);
    expect(sim.finish().commandCount).toBe(1);
  });

  it("splashes: bunny moves ONTO the water tile, then the run ends", () => {
    const result = run({ rows: ["W..", "..."], start: { x: 1, y: 0, dir: "W" } }, [move]);
    expect(result.termination).toBe("SPLASHED");
    expect(result.finalPose).toEqual({ x: 0, y: 0, dir: "W" });
    expect(result.events.slice(-2)).toEqual([
      { type: "move", from: { x: 1, y: 0, dir: "W" }, to: { x: 0, y: 0, dir: "W" }, step: 1 },
      { type: "splash", x: 0, y: 0, step: 1 },
    ]);
  });

  it("halts when the command budget is exceeded, before running the offender", () => {
    const result = run(open("N"), [left, left, left, left, left], { maxCommands: 3 });
    expect(result.termination).toBe("BUDGET_EXCEEDED");
    // 3 turns executed; the 4th command is rejected and never runs.
    expect(result.commandCount).toBe(3);
    expect(result.finalPose.dir).toBe("E");
    expect(result.events.at(-1)).toEqual({ type: "budgetExceeded", step: 4 });
  });
});

describe("collecting", () => {
  const carrotRow: GridVariantSpec = { rows: ["C.G", "..."], start: { x: 1, y: 0, dir: "W" } };

  it("auto-collects on tile entry when autoCollect is on", () => {
    const result = run(carrotRow, [move]);
    expect(result.collected).toBe(1);
    expect(result.totalCollectables).toBe(1);
    expect(result.events).toContainEqual({ type: "collect", x: 0, y: 0, step: 1, auto: true });
  });

  it("does not auto-collect when autoCollect is off", () => {
    const result = run(carrotRow, [move], { autoCollect: false });
    expect(result.collected).toBe(0);
    expect(result.events.some((e) => e.type === "collect")).toBe(false);
  });

  it("explicit collect picks up the carrot underfoot exactly once", () => {
    const result = run(carrotRow, [move, collect, collect], { autoCollect: false });
    expect(result.collected).toBe(1);
    expect(result.events).toContainEqual({ type: "collect", x: 0, y: 0, step: 2, auto: false });
    // Second collect on the now-empty tile is a non-fatal collectFail.
    expect(result.events).toContainEqual({ type: "collectFail", step: 3 });
    expect(result.termination).toBe("COMPLETED");
  });

  it("explicit collect on empty ground emits collectFail and continues", () => {
    const result = run(open("N"), [collect, move]);
    expect(result.events).toContainEqual({ type: "collectFail", step: 1 });
    expect(result.finalPose).toEqual({ x: 1, y: 0, dir: "N" });
    expect(result.termination).toBe("COMPLETED");
  });
});

describe("end-state goal rule", () => {
  const goalRow: GridVariantSpec = { rows: [".G.", "..."], start: { x: 0, y: 0, dir: "E" } };

  it("reaches the goal only when the FINAL pose is on G", () => {
    const result = run(goalRow, [move]);
    expect(result.reachedGoal).toBe(true);
    expect(result.events.at(-1)).toEqual({ type: "goal", step: 1 });
  });

  it("passing through G without ending there is NOT reachedGoal", () => {
    const result = run(goalRow, [move, move]);
    expect(result.termination).toBe("COMPLETED");
    expect(result.finalPose).toEqual({ x: 2, y: 0, dir: "E" });
    expect(result.reachedGoal).toBe(false);
    expect(result.events.some((e) => e.type === "goal")).toBe(false);
  });

  it("a runtime error denies the goal even when standing on G", () => {
    const sim = new Simulation(goalRow, DEFAULT_CONFIG);
    sim.execute(move);
    const result = sim.finish("RUNTIME_ERROR");
    expect(result.termination).toBe("RUNTIME_ERROR");
    expect(result.reachedGoal).toBe(false);
  });
});

describe("sensors", () => {
  it("pathAhead is blocked by rock, edge, and water — open for ., C, G", () => {
    const sim = (rows: string[], x: number, y: number, dir: "N" | "E" | "S" | "W") =>
      new Simulation({ rows, start: { x, y, dir } }, DEFAULT_CONFIG);

    expect(sim(["#..", "..."], 1, 0, "W").sense({ type: "pathAhead" })).toBe(false); // rock
    expect(sim(["...", "..."], 0, 0, "W").sense({ type: "pathAhead" })).toBe(false); // edge
    expect(sim(["W..", "..."], 1, 0, "W").sense({ type: "pathAhead" })).toBe(false); // water is fatal terrain
    expect(sim(["...", "..."], 1, 0, "W").sense({ type: "pathAhead" })).toBe(true); // empty
    expect(sim(["C..", "..."], 1, 0, "W").sense({ type: "pathAhead" })).toBe(true); // carrot
    expect(sim(["G..", "..."], 1, 0, "W").sense({ type: "pathAhead" })).toBe(true); // goal
  });

  it("onGoal tracks the current tile", () => {
    const sim = new Simulation({ rows: [".G.", "..."], start: { x: 0, y: 0, dir: "E" } }, DEFAULT_CONFIG);
    expect(sim.sense({ type: "onGoal" })).toBe(false);
    sim.execute(move);
    expect(sim.sense({ type: "onGoal" })).toBe(true);
  });

  it("sensing is free: it never consumes command budget", () => {
    const sim = new Simulation(open("N"), { ...DEFAULT_CONFIG, maxCommands: 1 });
    for (let i = 0; i < 50; i += 1) {
      sim.sense({ type: "pathAhead" });
      sim.sense({ type: "onGoal" });
    }
    sim.execute(move); // still within budget
    expect(sim.finish().commandCount).toBe(1);
  });
});

describe("say", () => {
  it("records say output in order alongside events", () => {
    const result = run(open("N"), [
      { type: "say", text: "hello" },
      move,
      { type: "say", text: "carrots!" },
    ]);
    expect(result.sayOutputs).toEqual(["hello", "carrots!"]);
    expect(result.events).toContainEqual({ type: "say", text: "hello", step: 1 });
    expect(result.events).toContainEqual({ type: "say", text: "carrots!", step: 3 });
  });
});

describe("golden event log", () => {
  const level: GridVariantSpec = { rows: [".C.", "...", "..G"], start: { x: 0, y: 0, dir: "E" } };
  const script: EngineCommand[] = [move, move, right, move, move];

  it("produces the exact pinned event log for the scripted run", () => {
    expect(run(level, script)).toEqual({
      events: [
        { type: "start", pose: { x: 0, y: 0, dir: "E" } },
        { type: "move", from: { x: 0, y: 0, dir: "E" }, to: { x: 1, y: 0, dir: "E" }, step: 1 },
        { type: "collect", x: 1, y: 0, step: 1, auto: true },
        { type: "move", from: { x: 1, y: 0, dir: "E" }, to: { x: 2, y: 0, dir: "E" }, step: 2 },
        { type: "turn", dir: "right", pose: { x: 2, y: 0, dir: "S" }, step: 3 },
        { type: "move", from: { x: 2, y: 0, dir: "S" }, to: { x: 2, y: 1, dir: "S" }, step: 4 },
        { type: "move", from: { x: 2, y: 1, dir: "S" }, to: { x: 2, y: 2, dir: "S" }, step: 5 },
        { type: "goal", step: 5 },
      ],
      termination: "COMPLETED",
      reachedGoal: true,
      collected: 1,
      totalCollectables: 1,
      finalPose: { x: 2, y: 2, dir: "S" },
      commandCount: 5,
      sayOutputs: [],
    });
  });

  it("is fully deterministic across 100 identical runs", () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const result = run(level, script);
      hashes.add(createHash("sha256").update(JSON.stringify(result)).digest("hex"));
    }
    expect(hashes.size).toBe(1);
  });
});

describe("engine metadata", () => {
  it("pins ENGINE_VERSION for attempt stamping", () => {
    expect(ENGINE_VERSION).toBe("1.0.0");
  });
});
