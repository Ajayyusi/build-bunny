import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { getPlayableLevel } from "@/modules/learning/server/play";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import { submitAttempt, type AttemptResponse } from "@/modules/grading/server/submit";
import {
  addWorldToProgram,
  createCtx,
  createTestLevel,
  createTestModule,
  createTestProgram,
  createTestSchool,
  enableProgramForSchool,
  SYSTEM_ACTOR,
  wipeDatabase,
} from "../helpers/fixtures";

/**
 * The activity-engine registry (m4 task 4): CODE_PREDICTION and SEQUENCING
 * graded through the SAME submitAttempt pipeline grid levels use — same
 * idempotency, same reward transaction, same unlock engine. Mirrors
 * grading.test.ts's style (real fixture levels, no mocks) but exercises the
 * two new engines plus a grid level in the same fixture to prove the
 * existing BLOCK_CODING flow is genuinely unchanged by the registry
 * refactor.
 */

const uuid = () => randomUUID();

// ── Fixture payloads ────────────────────────────────────────────────────

const CODE_PREDICTION_PAYLOAD = {
  code: "for (var i = 0; i < 2; i++) {\n  moveForward();\n}\n",
  language: "javascript",
  prompt: { en: "How many times does moveForward() run?" },
  options: [
    { id: "one", text: { en: "1 time" } },
    { id: "two", text: { en: "2 times" } },
  ],
  correctOptionId: "two",
  wrongFeedback: { en: "Count the loop iterations again." },
};

const SEQUENCING_PAYLOAD = {
  prompt: { en: "Put the steps in order." },
  items: [
    { id: "a", text: { en: "First step" } },
    { id: "b", text: { en: "Second step" } },
    { id: "c", text: { en: "Third step" } },
  ],
  correctOrder: ["a", "b", "c"],
};

// ── Minimal grid fixture (same shape as grading.test.ts, kept local) ─────

type BlockNode = Record<string, unknown>;

function chain(blocks: BlockNode[]): BlockNode | undefined {
  let next: BlockNode | undefined;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = { ...blocks[i] };
    if (next) block["next"] = { block: next };
    next = block;
  }
  return next;
}

function program(...blocks: BlockNode[]): unknown {
  const body = chain(blocks);
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        { type: "bb_whenStart", id: "hat", ...(body ? { next: { block: body } } : {}) },
      ],
    },
  };
}

const b = (type: string, id: string): BlockNode => ({ type, id });

const GRID_PAYLOAD = {
  toolbox: [{ type: "bb_moveForward" }, { type: "bb_repeat" }],
  variants: [{ rows: ["...", "..G"], start: { x: 0, y: 1, dir: "E" } }],
  checks: [{ id: "reachedGoal", severity: "core" }],
  starCriteria: { threeStarMaxBlocks: 2 },
};

/** moveForward ×2 — the 3-star solution. */
const GRID_PASS = program(b("bb_moveForward", "m1"), b("bb_moveForward", "m2"));
/** No movement at all — stays off the goal. */
const GRID_FAIL = program();

// ── Fixture state ────────────────────────────────────────────────────────
//
// Each activity type gets its OWN school/program/world/module: the unlock
// engine gates modules and worlds sequentially (a module's order-2 level
// only opens once order-1 is COMPLETED; a world's second module only opens
// once its first module is fully complete), so three activity types sharing
// one module — as an earlier draft of this fixture did — left the 2nd and
// 3rd module permanently LOCKED for a fresh student. Three independent
// single-module worlds sidestep that entirely and mirror grading.test.ts's
// proven one-school-one-module fixture shape.

interface Scenario {
  school: { id: string; code: string };
  levelIds: string[];
}

async function setupScenario(
  prefix: string,
  levelSpecs: Parameters<typeof createTestLevel>[2][],
): Promise<Scenario> {
  const school = await createTestSchool(prefix);
  const program_ = await createTestProgram({ name: `${prefix} Program` });
  const world = await addWorldToProgram(program_.id, 1, { name: `${prefix} World` });
  const mod = await createTestModule(world.id, 1, `${prefix} Module`);
  const levelIds: string[] = [];
  for (const [index, spec] of levelSpecs.entries()) {
    const level = await createTestLevel(mod.id, index + 1, spec);
    levelIds.push(level.id);
  }
  await enableProgramForSchool(school.id, program_.id);
  return { school, levelIds };
}

let gridLevel1Id: string;
let gridLevel2Id: string;
let predictLevelId: string;
let predictNextId: string;
let sequenceLevelId: string;
let sequenceNextId: string;
let gridScenario: Scenario;
let predictScenario: Scenario;
let sequenceScenario: Scenario;

async function makeStudent(
  school: { id: string; code: string },
  n: number,
): Promise<SessionContext> {
  const student = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: `engine${n}`,
    displayName: `Engine ${n}`,
    studentIdentifier: `ENGINE-${n}`,
    grade: 4,
  });
  await recomputeUnlocks(student.userId);
  return createCtx({ userId: student.userId, role: "STUDENT", schoolId: school.id });
}

async function countsFor(studentUserId: string) {
  const [attempts, xpEvents] = await Promise.all([
    db.activityAttempt.count({ where: { studentUserId } }),
    db.xpEvent.count({ where: { studentUserId } }),
  ]);
  return { attempts, xpEvents };
}

beforeAll(async () => {
  await wipeDatabase();

  gridScenario = await setupScenario("Grid", [
    { title: "Grid One", activityType: "BLOCK_CODING", payload: GRID_PAYLOAD },
    { title: "Grid Two", activityType: "BLOCK_CODING", payload: GRID_PAYLOAD },
  ]);
  gridLevel1Id = gridScenario.levelIds[0]!;
  gridLevel2Id = gridScenario.levelIds[1]!;

  predictScenario = await setupScenario("Predict", [
    { title: "Predict One", activityType: "CODE_PREDICTION", payload: CODE_PREDICTION_PAYLOAD },
    { title: "Predict Next", activityType: "BLOCK_CODING", payload: GRID_PAYLOAD },
  ]);
  predictLevelId = predictScenario.levelIds[0]!;
  predictNextId = predictScenario.levelIds[1]!;

  sequenceScenario = await setupScenario("Sequence", [
    { title: "Sequence One", activityType: "SEQUENCING", payload: SEQUENCING_PAYLOAD },
    { title: "Sequence Next", activityType: "BLOCK_CODING", payload: GRID_PAYLOAD },
  ]);
  sequenceLevelId = sequenceScenario.levelIds[0]!;
  sequenceNextId = sequenceScenario.levelIds[1]!;
});

// ── CODE_PREDICTION ──────────────────────────────────────────────────────

describe("CODE_PREDICTION grading (through submitAttempt, the real pipeline)", () => {
  it("correct option: PASS, full stars, XP, unlocks the next level, replay is idempotent", async () => {
    const ctx = await makeStudent(predictScenario.school, 1);
    const runId = uuid();

    const outcome = await submitAttempt(ctx, predictLevelId, {
      attemptRunId: runId,
      answer: { optionId: "two" },
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;
    expect(body.verdict).toBe("PASS");
    expect(body.stars).toBe(3);
    expect(body.xpAwarded).toBeGreaterThan(0);
    expect(body.feedback).toBeNull();
    expect(body.unlockedLevelIds).toEqual([predictNextId]);

    const attempt = await db.activityAttempt.findUnique({ where: { attemptRunId: runId } });
    expect(attempt?.verdict).toBe("PASS");
    expect(attempt?.generatedCode).toBe(""); // no code engine involved
    expect(attempt?.blockCount).toBeNull();
    expect(attempt?.workspaceJson).toEqual({ optionId: "two" }); // inputs, not frames

    const progress = await db.studentProgress.findFirst({
      where: { studentUserId: ctx.userId, levelId: predictLevelId },
    });
    expect(progress?.status).toBe("COMPLETED");
    expect(progress?.stars).toBe(3);

    // Replay: identical response, zero additional attempts/XP (idempotency).
    const before = await countsFor(ctx.userId);
    const replay = await submitAttempt(ctx, predictLevelId, {
      attemptRunId: runId,
      answer: { optionId: "one" }, // even a DIFFERENT answer must not re-grade
    });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(body);
    expect(await countsFor(ctx.userId)).toEqual(before);
  });

  it("incorrect option: FAIL, wrongOption feedback, zero reward", async () => {
    const ctx = await makeStudent(predictScenario.school, 2);
    const outcome = await submitAttempt(ctx, predictLevelId, {
      attemptRunId: uuid(),
      answer: { optionId: "one" },
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;
    expect(body.verdict).toBe("FAIL");
    expect(body.stars).toBe(0);
    expect(body.xpAwarded).toBe(0);
    expect(body.feedback?.code).toBe("wrongOption");
    expect(body.unlockedLevelIds).toEqual([]);

    const progress = await db.studentProgress.findFirst({
      where: { studentUserId: ctx.userId, levelId: predictLevelId },
    });
    expect(progress?.status).not.toBe("COMPLETED");
    expect(await db.xpEvent.count({ where: { studentUserId: ctx.userId } })).toBe(0);
  });
});

// ── SEQUENCING ───────────────────────────────────────────────────────────

describe("SEQUENCING grading (through submitAttempt, the real pipeline)", () => {
  it("correct order: PASS, full stars, XP, unlocks the next level, replay is idempotent", async () => {
    const ctx = await makeStudent(sequenceScenario.school, 3);
    const runId = uuid();

    const outcome = await submitAttempt(ctx, sequenceLevelId, {
      attemptRunId: runId,
      answer: { order: ["a", "b", "c"] },
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;
    expect(body.verdict).toBe("PASS");
    expect(body.stars).toBe(3);
    expect(body.xpAwarded).toBeGreaterThan(0);
    expect(body.unlockedLevelIds).toEqual([sequenceNextId]);

    const attempt = await db.activityAttempt.findUnique({ where: { attemptRunId: runId } });
    expect(attempt?.generatedCode).toBe("");
    expect(attempt?.blockCount).toBeNull();
    expect(attempt?.workspaceJson).toEqual({ order: ["a", "b", "c"] });

    const before = await countsFor(ctx.userId);
    const replay = await submitAttempt(ctx, sequenceLevelId, {
      attemptRunId: runId,
      answer: { order: ["c", "b", "a"] },
    });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(body);
    expect(await countsFor(ctx.userId)).toEqual(before);
  });

  it("incorrect order: FAIL, wrongOrder feedback, zero reward", async () => {
    const ctx = await makeStudent(sequenceScenario.school, 4);
    const outcome = await submitAttempt(ctx, sequenceLevelId, {
      attemptRunId: uuid(),
      answer: { order: ["b", "a", "c"] },
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;
    expect(body.verdict).toBe("FAIL");
    expect(body.stars).toBe(0);
    expect(body.xpAwarded).toBe(0);
    expect(body.feedback?.code).toBe("wrongOrder");

    expect(await db.xpEvent.count({ where: { studentUserId: ctx.userId } })).toBe(0);
  });
});

// ── Answer keys never reach the student loader ──────────────────────────

describe("student payload loader never exposes answer keys", () => {
  it("CODE_PREDICTION: correctOptionId is stripped from getPlayableLevel", async () => {
    const ctx = await makeStudent(predictScenario.school, 5);
    const playable = await getPlayableLevel(ctx, predictLevelId);
    expect(playable).not.toBeNull();
    const payload = playable?.payload as Record<string, unknown>;
    expect(payload["correctOptionId"]).toBeUndefined();
    expect("correctOptionId" in payload).toBe(false);
    expect(JSON.stringify(playable)).not.toContain("correctOptionId");
    // Non-answer authored copy must still be present (including the
    // correct option's id/text — every option is meant to be visible; only
    // WHICH one is correct is the secret).
    expect(payload["code"]).toBe(CODE_PREDICTION_PAYLOAD.code);
    expect(payload["wrongFeedback"]).toEqual(CODE_PREDICTION_PAYLOAD.wrongFeedback);
  });

  it("SEQUENCING: correctOrder is stripped from getPlayableLevel", async () => {
    const ctx = await makeStudent(sequenceScenario.school, 6);
    const playable = await getPlayableLevel(ctx, sequenceLevelId);
    expect(playable).not.toBeNull();
    const payload = playable?.payload as Record<string, unknown>;
    expect(payload["correctOrder"]).toBeUndefined();
    expect("correctOrder" in payload).toBe(false);
    expect(JSON.stringify(playable)).not.toContain("correctOrder");
    expect(payload["items"]).toEqual(SEQUENCING_PAYLOAD.items);
  });
});

// ── Body shape must match the level's own activity type ─────────────────

describe("a body shape that doesn't match the level's activity type is rejected", () => {
  it("a workspaceJson-shaped submission against a CODE_PREDICTION level is rejected", async () => {
    const ctx = await makeStudent(predictScenario.school, 7);
    const outcome = await submitAttempt(ctx, predictLevelId, {
      attemptRunId: uuid(),
      workspaceJson: {},
    });
    expect(outcome.status).toBe(400);
    expect(
      await db.activityAttempt.count({ where: { studentUserId: ctx.userId } }),
    ).toBe(0);
  });

  it("an answer-shaped submission against a BLOCK_CODING level is rejected", async () => {
    const ctx = await makeStudent(gridScenario.school, 8);
    const outcome = await submitAttempt(ctx, gridLevel1Id, {
      attemptRunId: uuid(),
      answer: { optionId: "x" },
    });
    expect(outcome.status).toBe(400);
    expect(
      await db.activityAttempt.count({ where: { studentUserId: ctx.userId } }),
    ).toBe(0);
  });

  it("a workspaceJson-shaped submission against a SEQUENCING level is rejected", async () => {
    const ctx = await makeStudent(sequenceScenario.school, 9);
    const outcome = await submitAttempt(ctx, sequenceLevelId, {
      attemptRunId: uuid(),
      workspaceJson: { blocks: {} },
    });
    expect(outcome.status).toBe(400);
  });
});

// ── The existing grid flow is unchanged ──────────────────────────────────

describe("BLOCK_CODING still grades exactly as before the registry refactor", () => {
  it("PASS awards XP/stars, unlocks the next level, and stores real generated code", async () => {
    const ctx = await makeStudent(gridScenario.school, 10);
    const runId = uuid();
    const outcome = await submitAttempt(ctx, gridLevel1Id, {
      attemptRunId: runId,
      workspaceJson: GRID_PASS,
      clientVerdict: "PASS",
      durationMs: 1234,
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;
    expect(body.verdict).toBe("PASS");
    expect(body.stars).toBe(3);
    expect(body.xpAwarded).toBeGreaterThan(0);
    expect(body.gradeMismatch).toBe(false);
    expect(body.unlockedLevelIds).toEqual([gridLevel2Id]);

    const attempt = await db.activityAttempt.findUnique({ where: { attemptRunId: runId } });
    expect(attempt?.generatedCode).toContain("moveForward();");
    expect(attempt?.blockCount).toBe(2);
    expect(attempt?.durationMs).toBe(1234);
    expect(attempt?.workspaceJson).toEqual(GRID_PASS);
  });

  it("FAIL grades a bad program to 0 stars with located feedback, no reward", async () => {
    const ctx = await makeStudent(gridScenario.school, 11);
    const outcome = await submitAttempt(ctx, gridLevel1Id, {
      attemptRunId: uuid(),
      workspaceJson: GRID_FAIL,
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;
    expect(body.verdict).toBe("FAIL");
    expect(body.stars).toBe(0);
    expect(body.xpAwarded).toBe(0);
    expect(body.feedback?.code).toBe("notOnGoal");
  });
});
