import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { submitAttempt } from "@/modules/grading/server/submit";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import { revealHintCore } from "@/modules/learning/server/play";
import { recommendWarmUp } from "@/modules/learning/server/recommend";
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
 * "What should I do next?" from observable signals: a child who has failed
 * the current level three times and climbed to a tier-2 hint is offered a
 * warm-up — a level they already completed that teaches the same concept —
 * and a child who is simply playing is offered nothing.
 */

type BlockNode = Record<string, unknown>;
const b = (type: string, id: string): BlockNode => ({ type, id });
function program(...blocks: BlockNode[]): unknown {
  let next: BlockNode | undefined;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = { ...blocks[i] };
    if (next) block["next"] = { block: next };
    next = block;
  }
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: "bb_whenStart", id: "hat", ...(next ? { next: { block: next } } : {}) }],
    },
  };
}

/** Level 1: two hops straight to the goal. */
const STRAIGHT_PAYLOAD = {
  toolbox: [{ type: "bb_moveForward" }, { type: "bb_repeat" }],
  variants: [{ rows: ["...", "..G"], start: { x: 0, y: 1, dir: "E" } }],
  checks: [{ id: "reachedGoal", severity: "core" }],
  starCriteria: { threeStarMaxBlocks: 2 },
};
const PASS_STRAIGHT = program(b("bb_moveForward", "m1"), b("bb_moveForward", "m2"));

/** Level 2: same shape, but a wrong turn walks off the grid → located FAIL. */
const TRAIL_PAYLOAD = {
  toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnRight" }, { type: "bb_repeat" }],
  variants: [{ rows: ["....", "...G"], start: { x: 0, y: 1, dir: "E" } }],
  checks: [{ id: "reachedGoal", severity: "core" }],
  starCriteria: { threeStarMaxBlocks: 2 },
};
const FAIL_TRAIL = program(b("bb_turnRight", "t1"), b("bb_moveForward", "m1"));

let ctx: SessionContext;
let learnId: string;
let trailId: string;

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Recommend");
  const program_ = await createTestProgram({ name: "Recommend Program" });
  const world = await addWorldToProgram(program_.id, 1, { name: "Recommend World" });
  const mod = await createTestModule(world.id, 1);
  const learn = await createTestLevel(mod.id, 1, {
    title: "Meet Loops",
    payload: STRAIGHT_PAYLOAD,
    tags: ["loops"],
  });
  const trail = await createTestLevel(mod.id, 2, {
    title: "Loop Trail",
    payload: TRAIL_PAYLOAD,
    tags: ["loops", "sequencing"],
  });
  learnId = learn.id;
  trailId = trail.id;
  await enableProgramForSchool(school.id, program_.id);

  const student = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "stuck1",
    displayName: "Stuck One",
    studentIdentifier: "REC-1",
    grade: 4,
  });
  await recomputeUnlocks(student.userId);
  ctx = createCtx({ userId: student.userId, role: "STUDENT", schoolId: school.id });
});

describe("warm-up recommendation", () => {
  it("offers nothing to a child who is not stuck", async () => {
    expect(await recommendWarmUp(ctx)).toBeNull();

    // Pass level 1, then fail level 2 twice: still not stuck.
    const pass = await submitAttempt(ctx, learnId, {
      attemptRunId: randomUUID(),
      workspaceJson: PASS_STRAIGHT,
    });
    expect(pass.status).toBe(200);
    for (let i = 0; i < 2; i += 1) {
      const fail = await submitAttempt(ctx, trailId, {
        attemptRunId: randomUUID(),
        workspaceJson: FAIL_TRAIL,
      });
      expect(fail.status).toBe(200);
      expect((fail.body as { verdict: string }).verdict).toBe("FAIL");
    }
    expect(await recommendWarmUp(ctx)).toBeNull();
  });

  it("after three failed runs and a second-tier hint, suggests the completed loops level", async () => {
    // The real ladder: tier 1 is free; tier 2 opens only after another run.
    await revealHintCore(ctx, { levelId: trailId, tier: 1 });
    const third = await submitAttempt(ctx, trailId, {
      attemptRunId: randomUUID(),
      workspaceJson: FAIL_TRAIL,
    });
    expect(third.status).toBe(200);
    await revealHintCore(ctx, { levelId: trailId, tier: 2 });

    const rec = await recommendWarmUp(ctx);
    expect(rec).not.toBeNull();
    expect(rec?.levelId).toBe(learnId);
    expect(rec?.stuckLevelId).toBe(trailId);
    expect(rec?.title).toEqual({ en: "Meet Loops" });
    expect(rec?.signals).toEqual({ failedRuns: 3, hintTier: 2 });

    // The signals are the child's own rows — nothing was written to decide this.
    expect(await db.activityAttempt.count({ where: { studentUserId: ctx.userId } })).toBe(4);
  });
});
