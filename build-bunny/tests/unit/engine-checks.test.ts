import { describe, expect, it } from "vitest";
import {
  EngineHalt,
  Simulation,
  aggregateVerdict,
  computeStars,
  evaluateChecks,
  type BlockStats,
  type Check,
  type CheckFailure,
  type EngineCommand,
  type GridVariantSpec,
  type RunResult,
  type Termination,
} from "@/engine";

/**
 * Check evaluation + verdict aggregation + star math (m3-contracts). Run
 * results come from REAL simulation runs so codes/data are exercised
 * end-to-end, not hand-crafted.
 */

const CONFIG = { autoCollect: true, nonFatalBumps: false, maxCommands: 1000 };

function runScript(variant: GridVariantSpec, commands: EngineCommand[]): RunResult {
  const sim = new Simulation(variant, CONFIG);
  try {
    for (const cmd of commands) sim.execute(cmd);
    return sim.finish();
  } catch (err) {
    if (err instanceof EngineHalt) return sim.finish(err.termination);
    throw err;
  }
}

function stats(countsByType: Record<string, number> = {}): BlockStats {
  return {
    totalBlocks: Object.values(countsByType).reduce((a, b) => a + b, 0),
    countsByType,
  };
}

const move: EngineCommand = { type: "moveForward" };
const left: EngineCommand = { type: "turnLeft" };

/** ".CG" corridor — one carrot, goal at the end. */
const corridor: GridVariantSpec = { rows: [".CG", "..."], start: { x: 0, y: 0, dir: "E" } };
const goalRun = runScript(corridor, [move, move]); // collects C, ends on G
const shortRun = runScript(corridor, [move]); // ends on C, not on G

const core = (id: Check["id"], params?: Record<string, unknown>): Check => ({
  id,
  severity: "core",
  params,
});
const secondary = (id: Check["id"], params?: Record<string, unknown>): Check => ({
  id,
  severity: "secondary",
  params,
});
const quality = (id: Check["id"], params?: Record<string, unknown>): Check => ({
  id,
  severity: "quality",
  params,
});

describe("evaluateChecks — reachedGoal", () => {
  it("passes when the run ends on the goal", () => {
    expect(evaluateChecks([core("reachedGoal")], goalRun, stats())).toEqual([]);
  });

  it("fails with notOnGoal when the run completes elsewhere", () => {
    expect(evaluateChecks([core("reachedGoal")], shortRun, stats())).toEqual([
      { id: "reachedGoal", severity: "core", code: "notOnGoal" },
    ]);
  });

  it("fails with bumped {step,x,y} after a rock bump", () => {
    const run = runScript({ rows: ["#..", "..."], start: { x: 2, y: 0, dir: "W" } }, [move, move]);
    expect(run.termination).toBe("BUMPED");
    expect(evaluateChecks([core("reachedGoal")], run, stats())).toEqual([
      { id: "reachedGoal", severity: "core", code: "bumped", data: { step: 2, x: 0, y: 0 } },
    ]);
  });

  it("fails with splashed {step,x,y} after entering water", () => {
    const run = runScript({ rows: [".W.", "..."], start: { x: 0, y: 0, dir: "E" } }, [move]);
    expect(run.termination).toBe("SPLASHED");
    expect(evaluateChecks([core("reachedGoal")], run, stats())).toEqual([
      { id: "reachedGoal", severity: "core", code: "splashed", data: { step: 1, x: 1, y: 0 } },
    ]);
  });

  it("fails with budget {step} when the command budget ran out", () => {
    const sim = new Simulation(corridor, { ...CONFIG, maxCommands: 2 });
    let run: RunResult;
    try {
      sim.execute(left);
      sim.execute(left);
      sim.execute(left);
      run = sim.finish();
    } catch (err) {
      if (!(err instanceof EngineHalt)) throw err;
      run = sim.finish(err.termination);
    }
    expect(run.termination).toBe("BUDGET_EXCEEDED");
    expect(evaluateChecks([core("reachedGoal")], run, stats())).toEqual([
      { id: "reachedGoal", severity: "core", code: "budget", data: { step: 3 } },
    ]);
  });
});

describe("evaluateChecks — collectedAll", () => {
  it("passes when every collectable was picked up", () => {
    expect(evaluateChecks([secondary("collectedAll")], goalRun, stats())).toEqual([]);
  });

  it("fails with carrotsLeft {collected,total}", () => {
    const run = runScript(
      { rows: ["CC.", "..."], start: { x: 2, y: 0, dir: "W" } },
      [move], // collects one of two
    );
    expect(evaluateChecks([secondary("collectedAll")], run, stats())).toEqual([
      { id: "collectedAll", severity: "secondary", code: "carrotsLeft", data: { collected: 1, total: 2 } },
    ]);
  });
});

describe("evaluateChecks — block checks", () => {
  it("avoidedTiles passes trivially in V1 (fatal tiles halt the run)", () => {
    expect(evaluateChecks([secondary("avoidedTiles")], shortRun, stats())).toEqual([]);
  });

  it("usedBlock passes when the block appears, fails with missingBlock otherwise", () => {
    const checks = [secondary("usedBlock", { block: "bb_repeat" })];
    expect(evaluateChecks(checks, goalRun, stats({ bb_repeat: 1 }))).toEqual([]);
    expect(evaluateChecks(checks, goalRun, stats({ bb_moveForward: 4 }))).toEqual([
      { id: "usedBlock", severity: "secondary", code: "missingBlock", data: { blockType: "bb_repeat" } },
    ]);
  });

  it("notUsedBlock fails with forbiddenBlock when the block appears", () => {
    const checks = [secondary("notUsedBlock", { block: "bb_say" })];
    expect(evaluateChecks(checks, goalRun, stats({ bb_moveForward: 2 }))).toEqual([]);
    expect(evaluateChecks(checks, goalRun, stats({ bb_say: 1 }))).toEqual([
      { id: "notUsedBlock", severity: "secondary", code: "forbiddenBlock", data: { blockType: "bb_say" } },
    ]);
  });

  it("maxBlocks compares totalBlocks against params.count (authored form)", () => {
    const checks = [quality("maxBlocks", { count: 3 })];
    expect(evaluateChecks(checks, goalRun, stats({ bb_moveForward: 3 }))).toEqual([]);
    expect(evaluateChecks(checks, goalRun, stats({ bb_moveForward: 3, bb_turnRight: 1 }))).toEqual([
      { id: "maxBlocks", severity: "quality", code: "tooManyBlocks", data: { used: 4, max: 3 } },
    ]);
  });

  it("maxBlocks also accepts params.max (starCriteria-derived form)", () => {
    expect(evaluateChecks([quality("maxBlocks", { max: 1 })], goalRun, stats({ bb_repeat: 2 }))).toEqual([
      { id: "maxBlocks", severity: "quality", code: "tooManyBlocks", data: { used: 2, max: 1 } },
    ]);
  });
});

describe("evaluateChecks — expectedOutput and unsupported ids", () => {
  it("expectedOutput compares say outputs in order", () => {
    const run = runScript(corridor, [
      { type: "say", text: "hop" },
      { type: "say", text: "hop hop" },
    ]);
    expect(
      evaluateChecks([core("expectedOutput", { expected: ["hop", "hop hop"] })], run, stats()),
    ).toEqual([]);
    expect(
      evaluateChecks([core("expectedOutput", { expected: ["hop"] })], run, stats()),
    ).toEqual([
      {
        id: "expectedOutput",
        severity: "core",
        code: "wrongOutput",
        data: { expected: ["hop"], actual: ["hop", "hop hop"] },
      },
    ]);
  });

  it.each(["variableEquals", "expectedSequence", "classifierResult"] as const)(
    "%s reports a quality-severity unsupported skip (never flips a verdict)",
    (id) => {
      const failures = evaluateChecks([core(id)], goalRun, stats());
      expect(failures).toEqual([{ id, severity: "quality", code: "unsupported" }]);
      // Even declared core, an unsupported check must not cause FAIL.
      expect(aggregateVerdict([failures], ["COMPLETED"])).toBe("PASS");
    },
  );
});

describe("aggregateVerdict truth table", () => {
  const coreFail: CheckFailure = { id: "reachedGoal", severity: "core", code: "notOnGoal" };
  const secondaryFail: CheckFailure = {
    id: "collectedAll",
    severity: "secondary",
    code: "carrotsLeft",
    data: { collected: 0, total: 1 },
  };
  const qualityFail: CheckFailure = {
    id: "maxBlocks",
    severity: "quality",
    code: "tooManyBlocks",
    data: { used: 9, max: 5 },
  };
  const done: Termination[] = ["COMPLETED", "COMPLETED"];

  it("PASS: all variants clean (quality failures do not matter)", () => {
    expect(aggregateVerdict([[], []], done)).toBe("PASS");
    expect(aggregateVerdict([[qualityFail], []], done)).toBe("PASS");
  });

  it("PARTIAL: cores clean everywhere, a secondary failed somewhere", () => {
    expect(aggregateVerdict([[], [secondaryFail]], done)).toBe("PARTIAL");
    expect(aggregateVerdict([[secondaryFail], [secondaryFail]], done)).toBe("PARTIAL");
    expect(aggregateVerdict([[qualityFail, secondaryFail], []], done)).toBe("PARTIAL");
  });

  it("FAIL: any core failure in any variant", () => {
    expect(aggregateVerdict([[], [coreFail]], done)).toBe("FAIL");
    expect(aggregateVerdict([[coreFail], []], done)).toBe("FAIL");
    expect(aggregateVerdict([[secondaryFail], [coreFail]], done)).toBe("FAIL");
  });

  it("FAIL: any fatal termination, even with zero check failures", () => {
    expect(aggregateVerdict([[], []], ["COMPLETED", "BUMPED"])).toBe("FAIL");
    expect(aggregateVerdict([[], []], ["SPLASHED"])).toBe("FAIL");
    expect(aggregateVerdict([[], []], ["BUDGET_EXCEEDED"])).toBe("FAIL");
    expect(aggregateVerdict([[], []], ["RUNTIME_ERROR"])).toBe("FAIL");
  });

  it("single-variant levels aggregate the same way", () => {
    expect(aggregateVerdict([[]], ["COMPLETED"])).toBe("PASS");
    expect(aggregateVerdict([[secondaryFail]], ["COMPLETED"])).toBe("PARTIAL");
    expect(aggregateVerdict([[coreFail]], ["COMPLETED"])).toBe("FAIL");
  });
});

describe("computeStars", () => {
  it("FAIL and ERROR earn 0 regardless of quality/hints", () => {
    expect(computeStars("FAIL", true, 0)).toBe(0);
    expect(computeStars("FAIL", false, 4)).toBe(0);
    expect(computeStars("ERROR", true, 0)).toBe(0);
  });

  it("PARTIAL earns 1, untouched by quality or hint caps", () => {
    expect(computeStars("PARTIAL", true, 0)).toBe(1);
    expect(computeStars("PARTIAL", false, 3)).toBe(1);
    expect(computeStars("PARTIAL", true, 4)).toBe(1);
  });

  it("PASS earns 2, or 3 when every quality check passed", () => {
    expect(computeStars("PASS", false, 0)).toBe(2);
    expect(computeStars("PASS", true, 0)).toBe(3);
  });

  it("hint tiers 3–4 cap this run at 2 stars; tiers 1–2 do not", () => {
    expect(computeStars("PASS", true, 1)).toBe(3);
    expect(computeStars("PASS", true, 2)).toBe(3);
    expect(computeStars("PASS", true, 3)).toBe(2);
    expect(computeStars("PASS", true, 4)).toBe(2);
    // The cap only lowers 3 → 2; a 2-star pass stays 2.
    expect(computeStars("PASS", false, 4)).toBe(2);
  });
});
