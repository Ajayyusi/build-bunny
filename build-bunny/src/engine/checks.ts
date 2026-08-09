import type {
  Check,
  CheckId,
  CheckSeverity,
  RunResult,
  Termination,
  Verdict,
} from "./types";

/**
 * Pure check evaluation (m3-contracts). Checks return machine codes + data;
 * feedback TEXT is app-side i18n — the engine never emits copy.
 */

/** Statement blocks only; the hat + sensor value blocks are excluded. */
export interface BlockStats {
  totalBlocks: number;
  countsByType: Record<string, number>;
}

export interface CheckFailure {
  id: CheckId;
  severity: CheckSeverity;
  code: string;
  data?: Record<string, unknown>;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Evaluate one variant's checks against its run result. */
export function evaluateChecks(
  checks: Check[],
  result: RunResult,
  blockStats: BlockStats,
): CheckFailure[] {
  const failures: CheckFailure[] = [];
  for (const check of checks) {
    const failure = evaluateCheck(check, result, blockStats);
    if (failure) failures.push(failure);
  }
  return failures;
}

function evaluateCheck(
  check: Check,
  result: RunResult,
  blockStats: BlockStats,
): CheckFailure | null {
  const params = check.params ?? {};

  switch (check.id) {
    case "reachedGoal": {
      if (result.reachedGoal) return null;
      return { ...failureBase(check), ...terminationFailure(result) };
    }

    case "collectedAll": {
      if (result.collected >= result.totalCollectables) return null;
      return {
        ...failureBase(check),
        code: "carrotsLeft",
        data: { collected: result.collected, total: result.totalCollectables },
      };
    }

    // Fatal tiles already halt the run in V1 (nonFatalBumps always false),
    // so surviving to evaluation means the tiles were avoided.
    case "avoidedTiles":
      return null;

    case "usedBlock": {
      const block = str(params.block) ?? str(params.blockType);
      if (!block) return null; // malformed params: publish gates own validation
      if ((blockStats.countsByType[block] ?? 0) > 0) return null;
      return { ...failureBase(check), code: "missingBlock", data: { blockType: block } };
    }

    case "notUsedBlock": {
      const block = str(params.block) ?? str(params.blockType);
      if (!block) return null;
      if ((blockStats.countsByType[block] ?? 0) === 0) return null;
      return { ...failureBase(check), code: "forbiddenBlock", data: { blockType: block } };
    }

    case "maxBlocks": {
      // Authored content uses {count}; starCriteria-derived checks use {max}.
      const max = num(params.count) ?? num(params.max);
      if (max === null) return null;
      if (blockStats.totalBlocks <= max) return null;
      return {
        ...failureBase(check),
        code: "tooManyBlocks",
        data: { used: blockStats.totalBlocks, max },
      };
    }

    case "expectedOutput": {
      const expected = Array.isArray(params.expected)
        ? params.expected.filter((v): v is string => typeof v === "string")
        : [];
      const matches =
        expected.length === result.sayOutputs.length &&
        expected.every((line, i) => line === result.sayOutputs[i]);
      if (matches) return null;
      return {
        ...failureBase(check),
        code: "wrongOutput",
        data: { expected, actual: [...result.sayOutputs] },
      };
    }

    // Not implemented in V1 (no content uses them). Reported as a
    // quality-severity skip so they can never flip a verdict.
    case "variableEquals":
    case "expectedSequence":
    case "classifierResult":
      return { id: check.id, severity: "quality", code: "unsupported" };
  }
}

function failureBase(check: Check): { id: CheckId; severity: CheckSeverity; code: string } {
  return { id: check.id, severity: check.severity, code: "failed" };
}

/** reachedGoal failure code derives from how the run ended (located feedback). */
function terminationFailure(result: RunResult): {
  code: string;
  data?: Record<string, unknown>;
} {
  switch (result.termination) {
    case "BUMPED": {
      const bump = result.events.find((e) => e.type === "bump");
      return bump
        ? { code: "bumped", data: { step: bump.step, x: bump.x, y: bump.y } }
        : { code: "bumped" };
    }
    case "SPLASHED": {
      const splash = result.events.find((e) => e.type === "splash");
      return splash
        ? { code: "splashed", data: { step: splash.step, x: splash.x, y: splash.y } }
        : { code: "splashed" };
    }
    case "BUDGET_EXCEEDED": {
      const budget = result.events.find((e) => e.type === "budgetExceeded");
      return budget ? { code: "budget", data: { step: budget.step } } : { code: "budget" };
    }
    default:
      return { code: "notOnGoal" };
  }
}

/**
 * Aggregate across variants (one program must pass ALL): FAIL when any core
 * check failed or any run ended fatally; PARTIAL when cores clean but ≥1
 * secondary failed somewhere; PASS otherwise. Quality never affects verdict.
 */
export function aggregateVerdict(
  perVariant: CheckFailure[][],
  terminations: Termination[],
): "PASS" | "PARTIAL" | "FAIL" {
  const fatal = terminations.some((t) => t !== "COMPLETED");
  const coreFailed = perVariant.some((failures) =>
    failures.some((f) => f.severity === "core"),
  );
  if (fatal || coreFailed) return "FAIL";
  const secondaryFailed = perVariant.some((failures) =>
    failures.some((f) => f.severity === "secondary"),
  );
  return secondaryFailed ? "PARTIAL" : "PASS";
}

/**
 * Stars: FAIL/ERROR 0 · PARTIAL 1 · PASS 2 · PASS + all quality checks 3.
 * Hint tiers 3–4 cap THIS run at 2 stars (StudentProgress keeps high-water).
 */
export function computeStars(
  verdict: Verdict,
  qualityPassed: boolean,
  hintTierUsed: number,
): 0 | 1 | 2 | 3 {
  if (verdict === "FAIL" || verdict === "ERROR") return 0;
  if (verdict === "PARTIAL") return 1;
  let stars: 2 | 3 = qualityPassed ? 3 : 2;
  if (hintTierUsed >= 3 && stars > 2) stars = 2;
  return stars;
}
