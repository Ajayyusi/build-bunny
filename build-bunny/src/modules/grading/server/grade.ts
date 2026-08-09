import "server-only";

import {
  aggregateVerdict,
  computeStars,
  evaluateChecks,
  type BlockStats,
  type Check,
  type CheckFailure,
  type Termination,
  type Verdict,
} from "@/engine";
import {
  generateRunnableCode,
  WhitelistViolationError,
} from "@/modules/blockly/server/codegen";
import {
  runProgramAllVariants,
  type ProgramRun,
} from "@/modules/blockly/interpreter";
import {
  blockCodingPayload,
  debuggingPayload,
} from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

/**
 * Authoritative grading (m3 contract): published snapshot + submitted
 * workspace JSON → verdict/stars/feedback. The client's own optimistic run is
 * never trusted — codegen and execution both happen here, from the raw
 * workspace, against the pinned published payload.
 */

export interface GradeVariantResult {
  checkFailures: CheckFailure[];
  termination: Termination;
  collected: number;
  commandCount: number;
}

export interface GradeOutcome {
  verdict: Verdict;
  /** Pre-hint-cap stars — the attempt pipeline applies the tier 3–4 cap. */
  stars: 0 | 1 | 2 | 3;
  qualityPassed: boolean;
  perVariant: GradeVariantResult[];
  /** Machine code + data for the player's located feedback banner. */
  primaryFeedback: { code: string; data?: Record<string, unknown> } | null;
  blockStats: BlockStats;
  generatedCode: string;
  runs: ProgramRun[];
}

const EMPTY_STATS: BlockStats = { totalBlocks: 0, countsByType: {} };

function errorOutcome(
  code: string,
  data?: Record<string, unknown>,
  partial?: Partial<Pick<GradeOutcome, "blockStats" | "generatedCode">>,
): GradeOutcome {
  return {
    verdict: "ERROR",
    stars: 0,
    qualityPassed: false,
    perVariant: [],
    primaryFeedback: data ? { code, data } : { code },
    blockStats: partial?.blockStats ?? EMPTY_STATS,
    generatedCode: partial?.generatedCode ?? "",
    runs: [],
  };
}

/**
 * Pick the failure the player should point at first: core failures beat
 * secondary (quality never surfaces as feedback), earliest variant wins.
 */
function primaryFailure(
  perVariant: CheckFailure[][],
): { code: string; data?: Record<string, unknown> } | null {
  for (const severity of ["core", "secondary"] as const) {
    for (const failures of perVariant) {
      const hit = failures.find((f) => f.severity === severity);
      if (hit) return { code: hit.code, data: hit.data };
    }
  }
  return null;
}

/**
 * Grade one workspace against a published level snapshot. DEBUGGING levels
 * grade identically to BLOCK_CODING (same engine, same checks) — the broken
 * workspace is only a starting point, never part of grading. This function
 * never throws for student-caused conditions: whitelist violations, codegen
 * failures and runtime errors all resolve to verdict ERROR.
 */
export function gradeWorkspace(
  levelSnapshot: LevelSnapshot,
  workspaceJson: unknown,
): GradeOutcome {
  const schema =
    levelSnapshot.activityType === "DEBUGGING" ? debuggingPayload : blockCodingPayload;
  const parsedPayload = schema.safeParse(levelSnapshot.payload);
  if (!parsedPayload.success) {
    // Publish gates make this unreachable for real content; a malformed
    // snapshot is an infrastructure failure, not the student's.
    return errorOutcome("runtimeError", { reason: "invalidPayload" });
  }
  const payload = parsedPayload.data;

  let code: string;
  let blockStats: BlockStats;
  try {
    ({ code, blockStats } = generateRunnableCode(workspaceJson, payload.toolbox));
  } catch (err) {
    if (err instanceof WhitelistViolationError) {
      return errorOutcome("whitelist", { violations: err.violations });
    }
    return errorOutcome("runtimeError", { reason: "codegen" });
  }

  const runs = runProgramAllVariants(code, payload);

  // Interpreter-level failure (syntax, sandbox exception, AST-step budget) is
  // infrastructure, not gameplay — distinct from the engine's command budget.
  if (runs.some((run) => run.termination === "RUNTIME_ERROR")) {
    return errorOutcome("runtimeError", undefined, { blockStats, generatedCode: code });
  }

  // Effective checks = authored checks + the starCriteria-derived quality
  // check (3rd star = solution size at or under threeStarMaxBlocks).
  const checks: Check[] = [...(payload.checks as Check[])];
  const threeStarMaxBlocks = payload.starCriteria.threeStarMaxBlocks;
  if (threeStarMaxBlocks !== undefined) {
    checks.push({
      id: "maxBlocks",
      severity: "quality",
      params: { max: threeStarMaxBlocks },
    });
  }

  const perVariantFailures = runs.map((run) => evaluateChecks(checks, run, blockStats));
  const terminations = runs.map((run) => run.termination);
  const verdict = aggregateVerdict(perVariantFailures, terminations);
  const qualityPassed = perVariantFailures.every((failures) =>
    failures.every((f) => f.severity !== "quality"),
  );
  const stars = computeStars(verdict, qualityPassed, 0);

  return {
    verdict,
    stars,
    qualityPassed,
    perVariant: runs.map((run, i) => ({
      checkFailures: perVariantFailures[i]!,
      termination: run.termination,
      collected: run.collected,
      commandCount: run.commandCount,
    })),
    primaryFeedback: primaryFailure(perVariantFailures),
    blockStats,
    generatedCode: code,
    runs,
  };
}
