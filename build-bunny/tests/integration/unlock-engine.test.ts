import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  computeAdventureState,
  getLevelIntro,
  recomputeUnlocks,
} from "@/modules/learning/server/adventure";
import type { AdventureState, AdventureWorldNode } from "@/modules/learning/server/adventure";
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
 * Unlock/progress engine semantics (M2 task 15). The suite is SEQUENTIAL:
 * each test advances the same student through the program and asserts the
 * engine's transitions, so ordering matters.
 *
 * Content graph under test:
 *   world 1: module 1 → L1(1) · draft(2) · L2(3) · L3(4, requires L1+L2) · archived(5)
 *            module 2 → L4(1)
 *   world 2: module 3 → L6(1)
 *   world 3: HORIZON (with a published level seeded inside — must never leak)
 */

let schoolId: string;
let studentId: string;
let ctx: SessionContext;
let freshCtx: SessionContext; // second student — never progresses

let w1Id: string;
let w2Id: string;
let w3Id: string;
let l1Id: string;
let l2Id: string;
let l3Id: string;
let l4Id: string;
let l6Id: string;
let draftId: string;
let archivedId: string;
let horizonLevelId: string;

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Unlock");
  schoolId = school.id;

  const student = await createStudent(SYSTEM_ACTOR, {
    schoolId,
    schoolCode: school.code,
    username: "hop",
    displayName: "Hop Tester",
    studentIdentifier: "UNLOCK-001",
    grade: 4,
  });
  studentId = student.userId;
  ctx = createCtx({ userId: studentId, role: "STUDENT", schoolId });

  const fresh = await createStudent(SYSTEM_ACTOR, {
    schoolId,
    schoolCode: school.code,
    username: "skip",
    displayName: "Fresh Tester",
    studentIdentifier: "UNLOCK-002",
    grade: 4,
  });
  freshCtx = createCtx({ userId: fresh.userId, role: "STUDENT", schoolId });

  const program = await createTestProgram({ name: "Unlock Program" });
  const w1 = await addWorldToProgram(program.id, 1, { name: "World One" });
  const w2 = await addWorldToProgram(program.id, 2, { name: "World Two" });
  const w3 = await addWorldToProgram(program.id, 3, {
    name: "Horizon World",
    horizon: true,
  });
  w1Id = w1.id;
  w2Id = w2.id;
  w3Id = w3.id;

  const m1 = await createTestModule(w1.id, 1);
  const m2 = await createTestModule(w1.id, 2);
  const m3 = await createTestModule(w2.id, 1);
  const mh = await createTestModule(w3.id, 1);

  const l1 = await createTestLevel(m1.id, 1, { title: "Level One" });
  const draft = await createTestLevel(m1.id, 2, { status: "DRAFT" });
  const l2 = await createTestLevel(m1.id, 3, { title: "Level Two" });
  const l3 = await createTestLevel(m1.id, 4, {
    title: "Level Three",
    requires: [l1.id, l2.id],
  });
  const archived = await createTestLevel(m1.id, 5, { status: "ARCHIVED" });
  const l4 = await createTestLevel(m2.id, 1, { title: "Level Four" });
  const l6 = await createTestLevel(m3.id, 1, { title: "Level Six" });
  // Published level INSIDE a horizon world: must never be exposed or unlocked.
  const lh = await createTestLevel(mh.id, 1, { title: "Beyond the Horizon" });
  l1Id = l1.id;
  l2Id = l2.id;
  l3Id = l3.id;
  l4Id = l4.id;
  l6Id = l6.id;
  draftId = draft.id;
  archivedId = archived.id;
  horizonLevelId = lh.id;

  await enableProgramForSchool(schoolId, program.id);
});

function world(state: AdventureState, id: string): AdventureWorldNode {
  const node = state.worlds.find((w) => w.id === id);
  expect(node, `world ${id} missing from state`).toBeDefined();
  return node!;
}

async function progressRows() {
  const rows = await db.studentProgress.findMany({
    where: { studentUserId: studentId },
    select: { levelId: true, status: true, stars: true, unlockSource: true },
  });
  return new Map(rows.map((r) => [r.levelId, r]));
}

/** Mark a level COMPLETED for the main student (grading itself is M3). */
async function completeLevel(levelId: string, stars: number): Promise<void> {
  await db.studentProgress.upsert({
    where: { studentUserId_levelId: { studentUserId: studentId, levelId } },
    update: { status: "COMPLETED", stars, firstCompletedAt: new Date() },
    create: {
      schoolId,
      studentUserId: studentId,
      levelId,
      status: "COMPLETED",
      stars,
      unlockSource: "SEED",
      firstCompletedAt: new Date(),
    },
  });
}

describe("unlock engine", () => {
  it("fresh student before any recompute: content visible, all levels LOCKED", async () => {
    const state = await computeAdventureState(ctx);
    expect(state.program).not.toBeNull();
    expect(state.currentLevelId).toBeNull();
    const one = world(state, w1Id);
    // No rows yet — world 1 is still the current (first available) world.
    expect(one.state).toBe("CURRENT");
    expect(world(state, w2Id).state).toBe("LOCKED");
    for (const level of one.modules.flatMap((m) => m.levels)) {
      expect(level.state).toBe("LOCKED");
      expect(level.stars).toBe(0);
    }
  });

  it("recomputeUnlocks opens exactly the first level, unlockSource ORDER", async () => {
    await recomputeUnlocks(studentId);
    const rows = await progressRows();
    expect(rows.size).toBe(1);
    expect(rows.get(l1Id)?.status).toBe("UNLOCKED");
    expect(rows.get(l1Id)?.unlockSource).toBe("ORDER");

    const state = await computeAdventureState(ctx);
    expect(state.currentLevelId).toBe(l1Id);
    const one = world(state, w1Id).modules[0]!.levels.find((l) => l.id === l1Id);
    expect(one?.state).toBe("UNLOCKED");
    expect(one?.current).toBe(true);
    // Student-facing text comes from the published snapshot, not draft fields.
    expect(one?.title.en).toBe("Level One");
  });

  it("DRAFT and ARCHIVED levels are invisible and never counted", async () => {
    const state = await computeAdventureState(ctx);
    const json = JSON.stringify(state);
    expect(json).not.toContain(draftId);
    expect(json).not.toContain(archivedId);
    const one = world(state, w1Id);
    expect(one.modules[0]!.levels.map((l) => l.id)).toEqual([l1Id, l2Id, l3Id]);
    expect(one.totalLevels).toBe(4); // L1..L3 + L4, drafts/archived excluded
    expect(one.totalStars).toBe(12);
  });

  it("horizon worlds are always HORIZON and expose no levels", async () => {
    const state = await computeAdventureState(ctx);
    const horizon = world(state, w3Id);
    expect(horizon.state).toBe("HORIZON");
    expect(horizon.modules).toEqual([]);
    expect(horizon.totalLevels).toBe(0);
    expect(JSON.stringify(state)).not.toContain(horizonLevelId);
  });

  it("completing level 1 opens level 2 by ORDER, skipping the draft gap", async () => {
    await completeLevel(l1Id, 2);
    await recomputeUnlocks(studentId);
    const rows = await progressRows();
    // L2 opened linearly even though a DRAFT level sits between them in order.
    expect(rows.get(l2Id)?.status).toBe("UNLOCKED");
    expect(rows.get(l2Id)?.unlockSource).toBe("ORDER");
    // L3 has explicit prerequisites (L1 AND L2) — L2 is not completed yet.
    expect(rows.has(l3Id)).toBe(false);
    // Module 2 is gated until module 1 is fully completed.
    expect(rows.has(l4Id)).toBe(false);
    // World 2 became available (≥1 completed level in world 1) → first level opens.
    expect(rows.get(l6Id)?.status).toBe("UNLOCKED");
    expect(rows.get(l6Id)?.unlockSource).toBe("ORDER");
    // Nothing inside the horizon world ever unlocks.
    expect(rows.has(horizonLevelId)).toBe(false);
  });

  it("world states: world 1 CURRENT, world 2 AVAILABLE after first completion", async () => {
    const state = await computeAdventureState(ctx);
    expect(world(state, w1Id).state).toBe("CURRENT");
    expect(world(state, w2Id).state).toBe("AVAILABLE");
    expect(world(state, w3Id).state).toBe("HORIZON");
    expect(state.currentLevelId).toBe(l2Id);
  });

  it("prerequisite edges gate until ALL requirements complete, then unlockSource PREREQUISITE", async () => {
    await completeLevel(l2Id, 3);
    await recomputeUnlocks(studentId);
    const rows = await progressRows();
    expect(rows.get(l3Id)?.status).toBe("UNLOCKED");
    expect(rows.get(l3Id)?.unlockSource).toBe("PREREQUISITE");
    // Module gate still holds: L3 is unlocked but not completed.
    expect(rows.has(l4Id)).toBe(false);
  });

  it("recompute never downgrades or removes existing rows", async () => {
    const before = await progressRows();
    expect(before.get(l1Id)?.status).toBe("COMPLETED");
    await recomputeUnlocks(studentId);
    await recomputeUnlocks(studentId);
    const after = await progressRows();
    expect(after.size).toBe(before.size);
    for (const [levelId, row] of before) {
      expect(after.get(levelId)?.status).toBe(row.status);
      expect(after.get(levelId)?.stars).toBe(row.stars);
      expect(after.get(levelId)?.unlockSource).toBe(row.unlockSource);
    }
  });

  it("module gate: completing all of module 1 opens module 2's first level", async () => {
    await completeLevel(l3Id, 3);
    await recomputeUnlocks(studentId);
    const rows = await progressRows();
    expect(rows.get(l4Id)?.status).toBe("UNLOCKED");
    expect(rows.get(l4Id)?.unlockSource).toBe("ORDER");
  });

  it("world completion: world 1 COMPLETED, world 2 becomes CURRENT, counters aggregate", async () => {
    await completeLevel(l4Id, 1);
    await recomputeUnlocks(studentId);
    const state = await computeAdventureState(ctx);
    const one = world(state, w1Id);
    expect(one.state).toBe("COMPLETED");
    expect(one.completedLevels).toBe(4);
    expect(one.totalLevels).toBe(4);
    expect(one.starsEarned).toBe(2 + 3 + 3 + 1);
    expect(one.totalStars).toBe(12);
    const two = world(state, w2Id);
    expect(two.state).toBe("CURRENT");
    expect(state.currentLevelId).toBe(l6Id);
    expect(world(state, w3Id).state).toBe("HORIZON");
    // Horizon content still untouched after the whole run.
    const rows = await progressRows();
    expect(rows.has(horizonLevelId)).toBe(false);
  });

  it("getLevelIntro returns published text for an unlocked level and strips answers", async () => {
    const intro = await getLevelIntro(ctx, l6Id);
    expect(intro).not.toBeNull();
    expect(intro?.state).toBe("UNLOCKED");
    expect(intro?.stars).toBe(0);
    // Snapshot text, never the row's draft fields.
    expect(intro?.title.en).toBe("Level Six");
    expect(intro?.story?.en).toBe("Level Six story");
    expect(intro?.objective?.en).toBe("Level Six objective");
    expect(intro?.instructions?.en).toBe("Level Six instructions");
    // Answer-bearing content must be absent — as keys and as values.
    const record = intro as unknown as Record<string, unknown>;
    expect("payload" in record).toBe(false);
    expect("hints" in record).toBe(false);
    expect(JSON.stringify(intro)).not.toContain("SECRET");
  });

  it("getLevelIntro returns null for locked, draft, and horizon levels", async () => {
    // Same school, zero progress: everything is locked for the fresh student.
    expect(await getLevelIntro(freshCtx, l1Id)).toBeNull();
    // Unpublished content never resolves, whoever asks.
    expect(await getLevelIntro(ctx, draftId)).toBeNull();
    expect(await getLevelIntro(ctx, archivedId)).toBeNull();
    // Horizon worlds expose no playable levels.
    expect(await getLevelIntro(ctx, horizonLevelId)).toBeNull();
    // Unknown id resolves to nothing, not an error.
    expect(await getLevelIntro(ctx, "no-such-level")).toBeNull();
  });

  it("fresh student recompute is independent: only their first level opens", async () => {
    await recomputeUnlocks(freshCtx.userId);
    const rows = await db.studentProgress.findMany({
      where: { studentUserId: freshCtx.userId },
      select: { levelId: true, status: true },
    });
    expect(rows.length).toBe(1);
    expect(rows[0]?.levelId).toBe(l1Id);
    expect(rows[0]?.status).toBe("UNLOCKED");
    // The main student's completions are untouched by another recompute.
    const state = await computeAdventureState(ctx);
    expect(world(state, w1Id).state).toBe("COMPLETED");
  });
});
