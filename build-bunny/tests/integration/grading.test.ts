import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { ConflictError } from "@/modules/auth/server/guard";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import { getPlayableLevel, revealHintCore } from "@/modules/learning/server/play";
import { submitAttempt, type AttemptResponse } from "@/modules/grading/server/submit";
import { applyDailyActivity } from "@/modules/grading/server/streak";
import { ENGINE_VERSION } from "@/engine";
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
 * Grading + rewards pipeline (M3 wave 2). Real published fixture levels with
 * genuine gradeable payloads — every submission goes through headless Blockly
 * codegen, the interpreter and the engine, exactly like production.
 *
 * Level 1 grid (start 0,1 facing E — auto-collect on):
 *     . . . .
 *     ▶ C . G
 * reachedGoal core · collectedAll secondary · threeStarMaxBlocks 2.
 * Straight run collects the carrot; the "detour" over the top row reaches the
 * goal but misses it → PARTIAL.
 */

// ── Workspace builders (hat-wrapped stacks, same shape the editor saves) ──

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
        {
          type: "bb_whenStart",
          id: "hat",
          ...(body ? { next: { block: body } } : {}),
        },
      ],
    },
  };
}

const b = (type: string, id: string): BlockNode => ({ type, id });

/** repeat N { moveForward } — 2 statement blocks, the 3-star solution. */
const THREE_STAR_L1 = program({
  type: "bb_repeat",
  id: "r1",
  fields: { TIMES: 3 },
  inputs: { DO: { block: { type: "bb_moveForward", id: "m1" } } },
});

/** moveForward ×3 — passes everything but the block budget → 2 stars. */
const TWO_STAR_L1 = program(b("bb_moveForward", "m1"), b("bb_moveForward", "m2"), b("bb_moveForward", "m3"));

/** Over the top row: reaches the goal, misses the carrot → PARTIAL. */
const PARTIAL_L1 = program(
  b("bb_turnLeft", "t1"),
  b("bb_moveForward", "m1"),
  b("bb_turnRight", "t2"),
  b("bb_moveForward", "m2"),
  b("bb_moveForward", "m3"),
  b("bb_moveForward", "m4"),
  b("bb_turnRight", "t3"),
  b("bb_moveForward", "m5"),
);

/** turnRight then forward — walks off the grid → located bump FAIL. */
const FAIL_L1 = program(b("bb_turnRight", "t1"), b("bb_moveForward", "m1"));

/** bb_say is not in the level toolbox → whitelist ERROR. */
const WHITELIST_VIOLATION = program({ type: "bb_say", id: "s1", fields: { TEXT: "hi" } });

/** moveForward ×2 — the 3-star solution for levels 2 and 3. */
const THREE_STAR_L2 = program(b("bb_moveForward", "m1"), b("bb_moveForward", "m2"));

const L1_PAYLOAD = {
  toolbox: [
    { type: "bb_moveForward" },
    { type: "bb_turnLeft" },
    { type: "bb_turnRight" },
    { type: "bb_repeat" },
  ],
  variants: [{ rows: ["....", ".C.G"], start: { x: 0, y: 1, dir: "E" } }],
  checks: [
    { id: "reachedGoal", severity: "core" },
    { id: "collectedAll", severity: "secondary" },
  ],
  starCriteria: { threeStarMaxBlocks: 2 },
};

const STRAIGHT_PAYLOAD = {
  toolbox: [{ type: "bb_moveForward" }, { type: "bb_repeat" }],
  variants: [{ rows: ["...", "..G"], start: { x: 0, y: 1, dir: "E" } }],
  checks: [{ id: "reachedGoal", severity: "core" }],
  starCriteria: { threeStarMaxBlocks: 2 },
};

// ── Fixture state ────────────────────────────────────────────────────────

let schoolId: string;
let l1Id: string;
let l2Id: string;
let l3Id: string;
let worldSlug: string;

let passCtx: SessionContext; // S1: pass → replay → improve → finish the world
let failCtx: SessionContext; // S2: FAIL + locked-level probes
let partialCtx: SessionContext; // S3: PARTIAL
let errorCtx: SessionContext; // S4: whitelist ERROR
let hintCtx: SessionContext; // S5: hint gating + star cap
let streakCtx: SessionContext; // S6: streak timeline
let previewCtx: SessionContext; // S7 impersonated: PREVIEW short-circuit

const uuid = () => randomUUID();

async function makeStudent(school: { id: string; code: string }, n: number) {
  const student = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: `grader${n}`,
    displayName: `Grader ${n}`,
    studentIdentifier: `GRADE-${n}`,
    grade: 4,
  });
  await recomputeUnlocks(student.userId);
  return createCtx({ userId: student.userId, role: "STUDENT", schoolId: school.id });
}

async function countsFor(studentUserId: string) {
  const [attempts, xpEvents, events, daily, progress] = await Promise.all([
    db.activityAttempt.count({ where: { studentUserId } }),
    db.xpEvent.count({ where: { studentUserId } }),
    db.learningEvent.count({ where: { studentUserId } }),
    db.studentDailyActivity.count({ where: { studentUserId } }),
    db.studentProgress.count({ where: { studentUserId } }),
  ]);
  return { attempts, xpEvents, events, daily, progress };
}

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Grading");
  schoolId = school.id;

  const program_ = await createTestProgram({ name: "Grading Program" });
  const world = await addWorldToProgram(program_.id, 1, { name: "Grading World" });
  worldSlug = world.slug;
  const mod = await createTestModule(world.id, 1);
  const l1 = await createTestLevel(mod.id, 1, {
    title: "Carrot Run",
    payload: L1_PAYLOAD,
    tags: ["loops"],
  });
  const l2 = await createTestLevel(mod.id, 2, {
    title: "Straight Shot",
    payload: STRAIGHT_PAYLOAD,
    tags: ["loops"],
  });
  const l3 = await createTestLevel(mod.id, 3, {
    title: "Final Stretch",
    payload: STRAIGHT_PAYLOAD,
  });
  l1Id = l1.id;
  l2Id = l2.id;
  l3Id = l3.id;
  await enableProgramForSchool(schoolId, program_.id);

  await db.achievement.create({
    data: {
      slug: "first-program",
      name: { en: "First Program" },
      description: { en: "Complete your first level" },
      icon: "🏁",
      criteria: { type: "FIRST_PASS" },
      order: 1,
    },
  });
  await db.achievement.create({
    data: {
      slug: "loop-fan",
      name: { en: "Loop Fan" },
      description: { en: "Complete two loop levels" },
      icon: "🔁",
      criteria: { type: "LEVELS_WITH_TAG", tag: "loops", count: 2 },
      order: 2,
    },
  });

  passCtx = await makeStudent(school, 1);
  failCtx = await makeStudent(school, 2);
  partialCtx = await makeStudent(school, 3);
  errorCtx = await makeStudent(school, 4);
  hintCtx = await makeStudent(school, 5);
  streakCtx = await makeStudent(school, 6);
  const preview = await makeStudent(school, 7);
  previewCtx = { ...preview, impersonatedBy: "platform-admin-id" };
});

// ── The pipeline ─────────────────────────────────────────────────────────

describe("attempt submission pipeline", () => {
  let firstResponse: AttemptResponse;
  const firstRunId = uuid();

  it("PASS run awards level XP + stars, completes progress and unlocks the next level", async () => {
    // A pre-existing draft must be cleared by the PASS.
    await db.studentProgress.updateMany({
      where: { studentUserId: passCtx.userId, levelId: l1Id },
      data: { draftWorkspace: { marker: "draft" }, draftSavedAt: new Date() },
    });

    const outcome = await submitAttempt(passCtx, l1Id, {
      attemptRunId: firstRunId,
      workspaceJson: TWO_STAR_L1,
      clientVerdict: "PASS",
      durationMs: 4321,
    });
    expect(outcome.status).toBe(200);
    firstResponse = outcome.body as AttemptResponse;

    expect(firstResponse.verdict).toBe("PASS");
    expect(firstResponse.stars).toBe(2); // 3 blocks > threeStarMaxBlocks 2
    expect(firstResponse.starsBest).toBe(2);
    expect(firstResponse.xpAwarded).toBe(60); // LEVEL_PASS 50 (EASY) + STAR_2 10
    expect(firstResponse.xpTotal).toBe(60);
    expect(firstResponse.unlockedLevelIds).toEqual([l2Id]);
    expect(firstResponse.worldCompleted).toBeNull();
    expect(firstResponse.feedback).toBeNull();
    expect(firstResponse.gradeMismatch).toBe(false);
    expect(firstResponse.newAchievements.map((a) => a.slug)).toEqual(["first-program"]);

    const progress = await db.studentProgress.findFirst({
      where: { studentUserId: passCtx.userId, levelId: l1Id },
    });
    expect(progress?.status).toBe("COMPLETED");
    expect(progress?.stars).toBe(2);
    expect(progress?.attemptsCount).toBe(1);
    expect(progress?.completedVersion).toBe(1);
    expect(progress?.firstCompletedAt).not.toBeNull();
    expect(progress?.draftWorkspace).toBeNull(); // cleared on PASS

    const profile = await db.studentProfile.findUnique({
      where: { userId: passCtx.userId },
    });
    expect(profile?.xpTotal).toBe(60);
    expect(profile?.starsTotal).toBe(2);
    expect(profile?.streakCurrent).toBeGreaterThanOrEqual(0); // weekday-dependent

    const xpSources = await db.xpEvent.findMany({
      where: { studentUserId: passCtx.userId, levelId: l1Id },
      select: { source: true, amount: true },
    });
    expect(new Map(xpSources.map((e) => [e.source, e.amount]))).toEqual(
      new Map([
        ["LEVEL_PASS", 50],
        ["STAR_2", 10],
      ]),
    );

    const attempt = await db.activityAttempt.findUnique({
      where: { attemptRunId: firstRunId },
    });
    expect(attempt?.verdict).toBe("PASS");
    expect(attempt?.kind).toBe("NORMAL");
    expect(attempt?.engineVersion).toBe(ENGINE_VERSION);
    expect(attempt?.levelVersion).toBe(1);
    expect(attempt?.blockCount).toBe(3);
    expect(attempt?.durationMs).toBe(4321);
    expect(attempt?.generatedCode).toContain("moveForward();");

    const eventTypes = (
      await db.learningEvent.findMany({
        where: { studentUserId: passCtx.userId, levelId: l1Id },
        select: { type: true },
      })
    ).map((e) => e.type);
    expect(eventTypes).toContain("RUN_EXECUTED");
    expect(eventTypes).toContain("RUN_SUCCEEDED");
    expect(eventTypes).toContain("LEVEL_COMPLETED");
  });

  it("replaying the same attemptRunId returns the stored response and changes nothing", async () => {
    const before = await countsFor(passCtx.userId);
    const profileBefore = await db.studentProfile.findUnique({
      where: { userId: passCtx.userId },
      select: { xpTotal: true, starsTotal: true },
    });

    const replay = await submitAttempt(passCtx, l1Id, {
      attemptRunId: firstRunId,
      // Even a DIFFERENT workspace must not be re-graded under the same id.
      workspaceJson: FAIL_L1,
    });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(firstResponse);

    const after = await countsFor(passCtx.userId);
    expect(after).toEqual(before);
    const profileAfter = await db.studentProfile.findUnique({
      where: { userId: passCtx.userId },
      select: { xpTotal: true, starsTotal: true },
    });
    expect(profileAfter).toEqual(profileBefore);
  });

  it("an improved run (2→3 stars) awards only the STAR_3 delta", async () => {
    const outcome = await submitAttempt(passCtx, l1Id, {
      attemptRunId: uuid(),
      workspaceJson: THREE_STAR_L1,
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;

    expect(body.verdict).toBe("PASS");
    expect(body.stars).toBe(3);
    expect(body.starsBest).toBe(3);
    expect(body.xpAwarded).toBe(10); // STAR_3 only — no re-award of LEVEL_PASS/STAR_2
    expect(body.xpTotal).toBe(70);
    expect(body.unlockedLevelIds).toEqual([]); // level 2 already open
    expect(body.newAchievements).toEqual([]); // first-program fires exactly once

    const profile = await db.studentProfile.findUnique({
      where: { userId: passCtx.userId },
    });
    expect(profile?.xpTotal).toBe(70);
    expect(profile?.starsTotal).toBe(3);

    const firstPassAwards = await db.studentAchievement.count({
      where: { studentUserId: passCtx.userId },
    });
    expect(firstPassAwards).toBe(1);
  });

  it("FAIL run records the attempt with located feedback but never rewards", async () => {
    const outcome = await submitAttempt(failCtx, l1Id, {
      attemptRunId: uuid(),
      workspaceJson: FAIL_L1,
      clientVerdict: "PASS", // wrong on purpose → gradeMismatch telemetry
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;

    expect(body.verdict).toBe("FAIL");
    expect(body.stars).toBe(0);
    expect(body.xpAwarded).toBe(0);
    expect(body.xpTotal).toBe(0);
    expect(body.feedback?.code).toBe("bumped");
    expect(body.feedback?.data).toMatchObject({ step: 2 });
    expect(body.gradeMismatch).toBe(true);
    expect(body.unlockedLevelIds).toEqual([]);
    expect(body.newAchievements).toEqual([]);

    const progress = await db.studentProgress.findFirst({
      where: { studentUserId: failCtx.userId, levelId: l1Id },
    });
    expect(progress?.status).toBe("IN_PROGRESS"); // touched, not completed
    expect(progress?.stars).toBe(0);
    expect(progress?.attemptsCount).toBe(1);
    expect(progress?.firstCompletedAt).toBeNull();

    expect(await db.xpEvent.count({ where: { studentUserId: failCtx.userId } })).toBe(0);

    const eventTypes = (
      await db.learningEvent.findMany({
        where: { studentUserId: failCtx.userId, levelId: l1Id },
        select: { type: true },
      })
    ).map((e) => e.type);
    expect(eventTypes).toContain("RUN_EXECUTED");
    expect(eventTypes).toContain("RUN_FAILED");
    expect(eventTypes).not.toContain("RUN_SUCCEEDED");
    expect(eventTypes).not.toContain("LEVEL_COMPLETED");
  });

  it("PARTIAL run earns 1 star, completes the level and unlocks the next", async () => {
    const outcome = await submitAttempt(partialCtx, l1Id, {
      attemptRunId: uuid(),
      workspaceJson: PARTIAL_L1,
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;

    expect(body.verdict).toBe("PARTIAL");
    expect(body.stars).toBe(1);
    expect(body.xpAwarded).toBe(50); // LEVEL_PASS only — no star bonuses at 1 star
    expect(body.feedback?.code).toBe("carrotsLeft");
    expect(body.feedback?.data).toMatchObject({ collected: 0, total: 1 });
    expect(body.unlockedLevelIds).toEqual([l2Id]);

    const progress = await db.studentProgress.findFirst({
      where: { studentUserId: partialCtx.userId, levelId: l1Id },
    });
    expect(progress?.status).toBe("COMPLETED");
    expect(progress?.stars).toBe(1);
    // PARTIAL keeps the draft — the learner returns for the missing star.
  });

  it("locked and unknown levels are refused with a 403-shaped error", async () => {
    // Level 2 is locked for the FAIL student (level 1 never completed).
    const locked = await submitAttempt(failCtx, l2Id, {
      attemptRunId: uuid(),
      workspaceJson: THREE_STAR_L2,
    });
    expect(locked.status).toBe(403);
    expect(locked.body).toEqual({ error: "LOCKED" });

    const unknown = await submitAttempt(failCtx, "no-such-level", {
      attemptRunId: uuid(),
      workspaceJson: THREE_STAR_L2,
    });
    expect(unknown.status).toBe(403);
    expect(unknown.body).toEqual({ error: "LOCKED" });

    // Neither refusal recorded an attempt.
    expect(
      await db.activityAttempt.count({
        where: { studentUserId: failCtx.userId, levelId: { not: l1Id } },
      }),
    ).toBe(0);
  });

  it("whitelist violation grades as verdict ERROR without rewards", async () => {
    const outcome = await submitAttempt(errorCtx, l1Id, {
      attemptRunId: uuid(),
      workspaceJson: WHITELIST_VIOLATION,
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;

    expect(body.verdict).toBe("ERROR");
    expect(body.stars).toBe(0);
    expect(body.xpAwarded).toBe(0);
    expect(body.feedback?.code).toBe("whitelist");

    const attempt = await db.activityAttempt.findFirst({
      where: { studentUserId: errorCtx.userId, levelId: l1Id },
    });
    expect(attempt?.verdict).toBe("ERROR");
    expect(await db.xpEvent.count({ where: { studentUserId: errorCtx.userId } })).toBe(0);
    const progress = await db.studentProgress.findFirst({
      where: { studentUserId: errorCtx.userId, levelId: l1Id },
    });
    expect(progress?.status).not.toBe("COMPLETED");
  });

  it("PREVIEW (impersonated) attempts record the attempt row and nothing else", async () => {
    const before = await countsFor(previewCtx.userId);
    const outcome = await submitAttempt(previewCtx, l1Id, {
      attemptRunId: uuid(),
      workspaceJson: THREE_STAR_L1,
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;

    expect(body.verdict).toBe("PASS");
    expect(body.stars).toBe(3);
    expect(body.xpAwarded).toBe(0);
    expect(body.xpTotal).toBe(0);
    expect(body.unlockedLevelIds).toEqual([]);
    expect(body.newAchievements).toEqual([]);

    const after = await countsFor(previewCtx.userId);
    expect(after.attempts).toBe(before.attempts + 1);
    expect(after.xpEvents).toBe(before.xpEvents);
    expect(after.daily).toBe(before.daily);
    expect(after.progress).toBe(before.progress);
    // No RUN_* learning events beyond whatever existed before.
    expect(after.events).toBe(before.events);

    const attempt = await db.activityAttempt.findFirst({
      where: { studentUserId: previewCtx.userId },
    });
    expect(attempt?.kind).toBe("PREVIEW");
    expect(attempt?.viaImpersonation).toBe(true);

    const progress = await db.studentProgress.findFirst({
      where: { studentUserId: previewCtx.userId, levelId: l1Id },
    });
    expect(progress?.status).toBe("UNLOCKED"); // untouched
    expect(progress?.attemptsCount).toBe(0);
  });

  it("finishing every level of the world reports worldCompleted exactly once", async () => {
    const second = await submitAttempt(passCtx, l2Id, {
      attemptRunId: uuid(),
      workspaceJson: THREE_STAR_L2,
    });
    expect(second.status).toBe(200);
    const secondBody = second.body as AttemptResponse;
    expect(secondBody.verdict).toBe("PASS");
    expect(secondBody.worldCompleted).toBeNull();
    expect(secondBody.unlockedLevelIds).toEqual([l3Id]);
    // Second tagged "loops" completion → loop-fan fires here, exactly once.
    expect(secondBody.newAchievements.map((a) => a.slug)).toEqual(["loop-fan"]);

    const last = await submitAttempt(passCtx, l3Id, {
      attemptRunId: uuid(),
      workspaceJson: THREE_STAR_L2,
    });
    expect(last.status).toBe(200);
    const lastBody = last.body as AttemptResponse;
    expect(lastBody.verdict).toBe("PASS");
    expect(lastBody.worldCompleted).toEqual({
      slug: worldSlug,
      name: { en: "Grading World" },
    });
    expect(lastBody.newAchievements).toEqual([]); // loop-fan already earned

    const worldEvents = await db.learningEvent.count({
      where: { studentUserId: passCtx.userId, type: "WORLD_COMPLETED" },
    });
    expect(worldEvents).toBe(1);

    const loopFanAwards = await db.studentAchievement.count({
      where: {
        studentUserId: passCtx.userId,
        achievement: { slug: "loop-fan" },
      },
    });
    expect(loopFanAwards).toBe(1);
  });
});

// ── Hints ────────────────────────────────────────────────────────────────

describe("hint gating and star cap", () => {
  it("tier 1 is free; tier 2 stays locked until an attempt or the 60 s cooldown", async () => {
    const tier1 = await revealHintCore(hintCtx, { levelId: l1Id, tier: 1 });
    expect(tier1.text.en).toBe("SECRET_HINT tier 1");

    // Skipping straight to tier 3 violates tier order.
    await expect(
      revealHintCore(hintCtx, { levelId: l1Id, tier: 3 }),
    ).rejects.toThrow(ConflictError);

    // Tier 2 immediately after tier 1: no attempt yet, cooldown not elapsed.
    await expect(
      revealHintCore(hintCtx, { levelId: l1Id, tier: 2 }),
    ).rejects.toThrow(ConflictError);

    // A NORMAL attempt after the tier-1 reveal unlocks tier 2.
    await submitAttempt(hintCtx, l1Id, {
      attemptRunId: uuid(),
      workspaceJson: FAIL_L1,
    });
    const tier2 = await revealHintCore(hintCtx, { levelId: l1Id, tier: 2 });
    expect(tier2.text.en).toBe("SECRET_HINT tier 2");

    // Tier 3 blocked again... until the 60 s cooldown elapses (injected now).
    await expect(
      revealHintCore(hintCtx, { levelId: l1Id, tier: 3 }),
    ).rejects.toThrow(ConflictError);
    const tier3 = await revealHintCore(
      hintCtx,
      { levelId: l1Id, tier: 3 },
      new Date(Date.now() + 61_000),
    );
    expect(tier3.text.en).toBe("SECRET_HINT tier 3");

    // Re-revealing an already-used tier returns the text without a new row.
    const again = await revealHintCore(hintCtx, { levelId: l1Id, tier: 1 });
    expect(again.text.en).toBe("SECRET_HINT tier 1");
    expect(
      await db.hintUsage.count({
        where: { studentUserId: hintCtx.userId, levelId: l1Id },
      }),
    ).toBe(3);

    const hintEvents = await db.learningEvent.count({
      where: { studentUserId: hintCtx.userId, type: "HINT_USED" },
    });
    expect(hintEvents).toBe(3);

    const playable = await getPlayableLevel(hintCtx, l1Id);
    expect(playable?.hintsUsedTiers).toEqual([1, 2, 3]);
  });

  it("tier 3–4 usage caps a perfect run at 2 stars end-to-end", async () => {
    const outcome = await submitAttempt(hintCtx, l1Id, {
      attemptRunId: uuid(),
      workspaceJson: THREE_STAR_L1, // would earn 3 stars without hints
    });
    expect(outcome.status).toBe(200);
    const body = outcome.body as AttemptResponse;

    expect(body.verdict).toBe("PASS");
    expect(body.stars).toBe(2); // capped by tier-3 hint usage
    expect(body.starsBest).toBe(2);
    expect(body.xpAwarded).toBe(60); // LEVEL_PASS + STAR_2, STAR_3 not reached

    const attempt = await db.activityAttempt.findFirst({
      where: { studentUserId: hintCtx.userId, verdict: "PASS" },
    });
    expect(attempt?.hintTierUsed).toBe(3);
    expect(attempt?.starsEarned).toBe(2);
  });
});

// ── Streaks ──────────────────────────────────────────────────────────────

describe("school-day streaks (Asia/Dubai, Mon–Fri)", () => {
  // 2026-03-02 is a Monday. Instants at 08:00 UTC = midday in Dubai.
  const at = (day: string) => new Date(`${day}T08:00:00.000Z`);
  const base = {
    timeZone: "Asia/Dubai",
    weekStructure: null as unknown,
    runsDelta: 1,
  };

  it("increments across consecutive school days and survives the weekend gap", async () => {
    const student = { studentUserId: streakCtx.userId, schoolId };

    // Monday → first active day.
    let s = await applyDailyActivity(db, { ...student, ...base, now: at("2026-03-02") });
    expect(s).toMatchObject({ streakCurrent: 1, streakBest: 1, activityDate: "2026-03-02" });

    // Tuesday → consecutive school day increments.
    s = await applyDailyActivity(db, { ...student, ...base, now: at("2026-03-03") });
    expect(s).toMatchObject({ streakCurrent: 2, streakBest: 2 });

    // Second run the same Tuesday → counters accumulate, streak unchanged.
    s = await applyDailyActivity(db, { ...student, ...base, now: at("2026-03-03") });
    expect(s).toMatchObject({ streakCurrent: 2, streakBest: 2 });

    // Friday after skipping Wed+Thu → missed school days reset the streak.
    s = await applyDailyActivity(db, { ...student, ...base, now: at("2026-03-06") });
    expect(s).toMatchObject({ streakCurrent: 1, streakBest: 2 });

    // Saturday activity is recorded but never moves the streak.
    s = await applyDailyActivity(db, { ...student, ...base, now: at("2026-03-07") });
    expect(s).toMatchObject({ streakCurrent: 1, streakBest: 2 });

    // Monday after an active Friday → the weekend gap does NOT reset.
    s = await applyDailyActivity(db, { ...student, ...base, now: at("2026-03-09") });
    expect(s).toMatchObject({ streakCurrent: 2, streakBest: 2 });

    const profile = await db.studentProfile.findUnique({
      where: { userId: streakCtx.userId },
    });
    expect(profile?.streakCurrent).toBe(2);
    expect(profile?.streakBest).toBe(2);

    const days = await db.studentDailyActivity.findMany({
      where: { studentUserId: streakCtx.userId },
      orderBy: { date: "asc" },
    });
    expect(days).toHaveLength(5);
    expect(days[1]?.runs).toBe(2); // the double-Tuesday accumulated
  });
});
