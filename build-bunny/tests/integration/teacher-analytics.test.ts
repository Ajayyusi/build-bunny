import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  getClassAssignmentProgress,
  listMyStudentAssignments,
} from "@/modules/assignments/server/queries";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { gradeWorkspace } from "@/modules/grading/server/grade";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import {
  getAttemptReplay,
  getClassMatrix,
  getStudentDetail,
  getTeacherOverview,
} from "@/modules/analytics/server/teacher";
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
 * Teacher analytics (m4 task 1): matrix shape/cell correctness against real
 * seeded progress, each of the five flag rules firing exactly when — and
 * only when — its own condition holds, teacher-vs-teacher scope isolation
 * inside ONE school, the SCHOOL_ADMIN's wider scope, and a deterministic
 * attempt replay that reproduces the stored verdict.
 *
 * Content graph: world W1 → module M1 → level L1 (real gradeable BLOCK_CODING,
 * estimatedMinutes fixed at 5 by the createTestLevel fixture) · level L2
 * (ungraded, used only as a target for direct-write attempts/progress).
 * Class 4A (teacherOne) holds six students, one per flag scenario plus a
 * clean control; class 4B (teacherTwo) is the isolation counterpart.
 */

// ── Gradeable workspace builders (mirrors tests/integration/grading.test.ts) ─
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
      blocks: [{ type: "bb_whenStart", id: "hat", ...(body ? { next: { block: body } } : {}) }],
    },
  };
}

/** repeat 3 { moveForward } — 2 statement blocks, reaches goal + collects carrot: PASS, 3 stars. */
const THREE_STAR_WORKSPACE = program({
  type: "bb_repeat",
  id: "r1",
  fields: { TIMES: 3 },
  inputs: { DO: { block: { type: "bb_moveForward", id: "m1" } } },
});

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

let schoolId: string;
let classAId: string;
let classBId: string;
let teacherOneId: string;
let teacherTwoId: string;
let adminId: string;
let l1Id: string;
let l2Id: string;

let studentNormalId: string;
let studentStuckId: string;
let studentOvertimeId: string;
let studentHeavyHintsId: string;
let studentInactiveId: string;
let studentNotStartedId: string;
let studentInClassBId: string;

let ctxTeacherOne: SessionContext;
let ctxTeacherTwo: SessionContext;
let ctxAdmin: SessionContext;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Teach");
  schoolId = school.id;

  const year = await db.academicYear.create({
    data: {
      schoolId,
      name: "2026-2027",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2027-06-30T00:00:00Z"),
    },
  });

  const teacherOne = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-t1@test.example`,
    displayName: "Teacher One",
    role: "TEACHER",
    password: "teach-pass-11",
  });
  teacherOneId = teacherOne.userId;
  const teacherTwo = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-t2@test.example`,
    displayName: "Teacher Two",
    role: "TEACHER",
    password: "teach-pass-22",
  });
  teacherTwoId = teacherTwo.userId;
  const admin = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-admin@test.example`,
    displayName: "Admin One",
    role: "SCHOOL_ADMIN",
    password: "admin-pass-11",
  });
  adminId = admin.userId;

  const classA = await db.class.create({
    data: { schoolId, academicYearId: year.id, name: "4A", grade: 4 },
  });
  classAId = classA.id;
  const classB = await db.class.create({
    data: { schoolId, academicYearId: year.id, name: "4B", grade: 4 },
  });
  classBId = classB.id;
  await db.classMembership.create({
    data: { schoolId, classId: classAId, userId: teacherOneId, role: "TEACHER" },
  });
  await db.classMembership.create({
    data: { schoolId, classId: classBId, userId: teacherTwoId, role: "TEACHER" },
  });

  const program_ = await createTestProgram({ name: "Teach Test Program" });
  const world = await addWorldToProgram(program_.id, 1, { name: "World One" });
  const mod = await createTestModule(world.id, 1);
  const l1 = await createTestLevel(mod.id, 1, {
    title: "Level One",
    activityType: "BLOCK_CODING",
    payload: L1_PAYLOAD,
  });
  l1Id = l1.id;
  const l2 = await createTestLevel(mod.id, 2, { title: "Level Two" });
  l2Id = l2.id;
  await enableProgramForSchool(schoolId, program_.id);

  // ── Six students in class 4A, one per flag scenario + a clean control ────
  async function makeStudent(username: string, displayName: string, identifier: string) {
    const student = await createStudent(SYSTEM_ACTOR, {
      schoolId,
      schoolCode: school.code,
      username,
      displayName,
      studentIdentifier: identifier,
      grade: 4,
    });
    await db.classMembership.create({
      data: { schoolId, classId: classAId, userId: student.userId, role: "STUDENT" },
    });
    return student.userId;
  }

  studentNormalId = await makeStudent("normal", "Normal Student", "T-001");
  studentStuckId = await makeStudent("stuck", "Stuck Student", "T-002");
  studentOvertimeId = await makeStudent("overtime", "Overtime Student", "T-003");
  studentHeavyHintsId = await makeStudent("hints", "Heavy Hints Student", "T-004");
  studentInactiveId = await makeStudent("inactive", "Inactive Student", "T-005");
  studentNotStartedId = await makeStudent("fresh", "Not Started Student", "T-006");

  const studentInClassB = await createStudent(SYSTEM_ACTOR, {
    schoolId,
    schoolCode: school.code,
    username: "classb",
    displayName: "Class B Student",
    studentIdentifier: "T-100",
    grade: 4,
  });
  studentInClassBId = studentInClassB.userId;
  await db.classMembership.create({
    data: { schoolId, classId: classBId, userId: studentInClassB.userId, role: "STUDENT" },
  });

  const NOW = new Date();
  const recent = async (userId: string) =>
    db.studentProfile.update({ where: { userId }, data: { lastActiveDate: NOW } });

  // 1) Normal: one PASS attempt on L1 (2 blocks, 3 stars), COMPLETED progress,
  // a tier-2 hint on L1. No flags expected — the control case.
  await db.studentProgress.create({
    data: { schoolId, studentUserId: studentNormalId, levelId: l1Id, status: "COMPLETED", stars: 3 },
  });
  await db.activityAttempt.create({
    data: {
      attemptRunId: "fx-normal-1",
      schoolId,
      studentUserId: studentNormalId,
      levelId: l1Id,
      levelVersion: 1,
      engineVersion: "1.0.0",
      kind: "NORMAL",
      workspaceJson: JSON.parse(JSON.stringify(THREE_STAR_WORKSPACE)),
      generatedCode: "",
      resultSummary: {},
      verdict: "PASS",
      starsEarned: 3,
      blockCount: 2,
      durationMs: 60_000,
    },
  });
  await db.hintUsage.create({
    data: { schoolId, studentUserId: studentNormalId, levelId: l1Id, tier: 2 },
  });
  await recent(studentNormalId);

  // 2) Stuck: 3 consecutive FAIL attempts on L2, not yet completed.
  await db.studentProgress.create({
    data: { schoolId, studentUserId: studentStuckId, levelId: l2Id, status: "IN_PROGRESS", stars: 0 },
  });
  for (let i = 0; i < 3; i += 1) {
    await db.activityAttempt.create({
      data: {
        attemptRunId: `fx-stuck-${i}`,
        schoolId,
        studentUserId: studentStuckId,
        levelId: l2Id,
        levelVersion: 1,
        engineVersion: "1.0.0",
        kind: "NORMAL",
        workspaceJson: {},
        generatedCode: "",
        resultSummary: {},
        verdict: "FAIL",
        starsEarned: 0,
      },
    });
  }
  await recent(studentStuckId);

  // 3) Overtime: two attempts on L1 summing to 1,000,000ms — well over the
  // 3 × 5min (900,000ms) threshold. Only 2 attempts, so STUCK never fires.
  for (let i = 0; i < 2; i += 1) {
    await db.activityAttempt.create({
      data: {
        attemptRunId: `fx-overtime-${i}`,
        schoolId,
        studentUserId: studentOvertimeId,
        levelId: l1Id,
        levelVersion: 1,
        engineVersion: "1.0.0",
        kind: "NORMAL",
        workspaceJson: {},
        generatedCode: "",
        resultSummary: {},
        verdict: "FAIL",
        starsEarned: 0,
        durationMs: 500_000,
      },
    });
  }
  await recent(studentOvertimeId);

  // 4) Heavy hints: tier-4 hint on TWO distinct levels, plus one attempt so
  // this student is not simultaneously NOT_STARTED.
  await db.hintUsage.create({
    data: { schoolId, studentUserId: studentHeavyHintsId, levelId: l1Id, tier: 4 },
  });
  await db.hintUsage.create({
    data: { schoolId, studentUserId: studentHeavyHintsId, levelId: l2Id, tier: 4 },
  });
  await db.activityAttempt.create({
    data: {
      attemptRunId: "fx-hints-1",
      schoolId,
      studentUserId: studentHeavyHintsId,
      levelId: l1Id,
      levelVersion: 1,
      engineVersion: "1.0.0",
      kind: "NORMAL",
      workspaceJson: {},
      generatedCode: "",
      resultSummary: {},
      verdict: "FAIL",
      starsEarned: 0,
    },
  });
  await recent(studentHeavyHintsId);

  // 5) Inactive: one attempt establishes "has played before", but the
  // profile's lastActiveDate is 10 days stale — well past 5 school days —
  // and the class has an OPEN assignment (the other leg of the OR).
  await db.activityAttempt.create({
    data: {
      attemptRunId: "fx-inactive-1",
      schoolId,
      studentUserId: studentInactiveId,
      levelId: l1Id,
      levelVersion: 1,
      engineVersion: "1.0.0",
      kind: "NORMAL",
      workspaceJson: {},
      generatedCode: "",
      resultSummary: {},
      verdict: "FAIL",
      starsEarned: 0,
    },
  });
  await db.studentProfile.update({
    where: { userId: studentInactiveId },
    data: { lastActiveDate: daysAgo(10) },
  });
  await db.assignment.create({
    data: {
      schoolId,
      classId: classAId,
      createdById: teacherOneId,
      target: "LEVEL",
      levelId: l1Id,
      title: "Finish level one",
    },
  });

  // 6) Not started: zero attempts, zero hints, no progress rows, no
  // lastActiveDate — must show only NOT_STARTED, never INACTIVE too.

  // ── A real ActivityAttempt for the replay test: a genuinely passing run. ─
  const replaySnapshot = {
    activityType: "BLOCK_CODING",
    payload: L1_PAYLOAD,
  } as unknown as LevelSnapshot;
  const expectedGrade = gradeWorkspace(replaySnapshot, THREE_STAR_WORKSPACE);
  expect(expectedGrade.verdict).toBe("PASS");
  expect(expectedGrade.stars).toBe(3);
  await db.activityAttempt.create({
    data: {
      attemptRunId: "fx-replay-1",
      schoolId,
      studentUserId: studentNormalId,
      levelId: l1Id,
      levelVersion: 1,
      engineVersion: "1.0.0",
      kind: "NORMAL",
      workspaceJson: JSON.parse(JSON.stringify(THREE_STAR_WORKSPACE)),
      generatedCode: expectedGrade.generatedCode,
      resultSummary: {},
      verdict: expectedGrade.verdict,
      starsEarned: expectedGrade.stars,
      blockCount: expectedGrade.blockStats.totalBlocks,
    },
  });

  ctxTeacherOne = createCtx({ userId: teacherOneId, role: "TEACHER", schoolId });
  ctxTeacherTwo = createCtx({ userId: teacherTwoId, role: "TEACHER", schoolId });
  ctxAdmin = createCtx({ userId: adminId, role: "SCHOOL_ADMIN", schoolId });
});

describe("getClassMatrix — shape and cell correctness", () => {
  it("returns levels grouped by world, in order", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    expect(matrix).not.toBeNull();
    expect(matrix!.levels.map((l) => l.id)).toEqual([l1Id, l2Id]);
    expect(matrix!.levels[0]!.worldSlug).toBe(matrix!.levels[1]!.worldSlug);
    expect(matrix!.levels[0]!.order).toBe(1);
    expect(matrix!.levels[1]!.order).toBe(2);
  });

  it("computes an exact cell for a completed, hinted level", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === studentNormalId)!;
    // Two attempts land on L1 for this student (the control PASS + the
    // replay fixture) — attempts counts both.
    expect(row.cells[l1Id]).toEqual({ status: "COMPLETED", stars: 3, attempts: 2, hintTierMax: 2 });
  });

  it("defaults an absent progress row to a LOCKED cell", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === studentNotStartedId)!;
    expect(row.cells[l1Id]).toEqual({ status: "LOCKED", stars: 0, attempts: 0, hintTierMax: 0 });
    expect(row.cells[l2Id]).toEqual({ status: "LOCKED", stars: 0, attempts: 0, hintTierMax: 0 });
  });

  it("rolls up an honest class summary", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    expect(matrix!.summary.studentCount).toBe(6);
    // Only studentNormal's L1 cell is COMPLETED — 1 of 12 possible cells.
    expect(matrix!.summary.completionPct).toBe(Math.round((1 / 12) * 100));
    expect(matrix!.summary.avgStars).toBe(3);
    expect(matrix!.summary.activeThisWeek).toBe(4);
    expect(matrix!.summary.startedCount).toBe(5);
  });
});

describe("student flags — each rule fires only under its own condition", () => {
  it("STUCK: 3 consecutive FAILs on a not-yet-completed level", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === studentStuckId)!;
    expect(row.flags).toEqual(["STUCK"]);
  });

  it("OVERTIME: cumulative duration on a level ≥ 3× its estimated minutes", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === studentOvertimeId)!;
    expect(row.flags).toEqual(["OVERTIME"]);
  });

  it("HEAVY_HINTS: tier-4 hint used on 2 or more levels", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === studentHeavyHintsId)!;
    expect(row.flags).toEqual(["HEAVY_HINTS"]);
  });

  it("INACTIVE: no recent activity while the class has an open assignment", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === studentInactiveId)!;
    expect(row.flags).toEqual(["INACTIVE"]);
  });

  it("NOT_STARTED: zero attempts ever, and never double-flagged INACTIVE too", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === studentNotStartedId)!;
    expect(row.flags).toEqual(["NOT_STARTED"]);
  });

  it("the clean control student carries no flags", async () => {
    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === studentNormalId)!;
    expect(row.flags).toEqual([]);
  });

  // Regression: progress imported or seeded without attempt rows is still
  // progress. Flagging a student who has completed work as "not started" is
  // the kind of thing a school notices in the first five minutes of a demo.
  it("NOT_STARTED never fires for a student with progress but no attempt rows", async () => {
    const { code } = (await db.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { code: true },
    }))!;
    const seeded = await createStudent(SYSTEM_ACTOR, {
      schoolId,
      schoolCode: code,
      username: "seededprogress",
      displayName: "Seeded Progress Student",
      studentIdentifier: "T-007",
      grade: 3,
    });
    await db.classMembership.create({
      data: { schoolId, classId: classAId, userId: seeded.userId, role: "STUDENT" },
    });
    await db.studentProgress.create({
      data: {
        schoolId,
        studentUserId: seeded.userId,
        levelId: l1Id,
        status: "COMPLETED",
        stars: 3,
      },
    });

    const matrix = await getClassMatrix(ctxTeacherOne, classAId);
    const row = matrix!.students.find((s) => s.userId === seeded.userId)!;
    expect(row.flags).not.toContain("NOT_STARTED");

    await db.studentProgress.deleteMany({ where: { studentUserId: seeded.userId } });
    await db.classMembership.deleteMany({ where: { userId: seeded.userId } });
    await db.user.delete({ where: { id: seeded.userId } });
  });
});

describe("teacher-scope isolation and school-admin wider scope", () => {
  it("a teacher only ever reaches their OWN class", async () => {
    expect(await getClassMatrix(ctxTeacherOne, classBId)).toBeNull();
    expect(await getClassMatrix(ctxTeacherTwo, classAId)).toBeNull();
    expect(await getClassMatrix(ctxTeacherOne, classAId)).not.toBeNull();
  });

  it("getTeacherOverview never surfaces another teacher's class or students", async () => {
    const overview = await getTeacherOverview(ctxTeacherOne);
    expect(overview.classes.map((c) => c.id)).toEqual([classAId]);
    const flaggedIds = overview.needsAttention.map((entry) => entry.studentUserId);
    expect(flaggedIds).not.toContain(studentInClassBId);
    expect(overview.needsAttention.every((entry) => entry.classId === classAId)).toBe(true);
  });

  it("a teacher cannot open a student who belongs to another teacher's class", async () => {
    expect(await getStudentDetail(ctxTeacherOne, studentInClassBId)).toBeNull();
    const own = await getStudentDetail(ctxTeacherOne, studentNormalId);
    expect(own?.studentUserId).toBe(studentNormalId);
  });

  it("SCHOOL_ADMIN reaches any class or student in the school, including ones they don't teach", async () => {
    const matrixB = await getClassMatrix(ctxAdmin, classBId);
    expect(matrixB?.classId).toBe(classBId);
    const detail = await getStudentDetail(ctxAdmin, studentInClassBId);
    expect(detail?.studentUserId).toBe(studentInClassBId);
  });

  it("SCHOOL_ADMIN's overview lists every class in the school, not just ones they teach", async () => {
    // This asserted an empty list, which contradicted the test directly
    // above it: an admin "reaches any class or student in the school", yet
    // had no list of those classes anywhere. The result was a dead end --
    // the nav offered them Teaching and the page showed "no classes yet"
    // for a school full of classes, while the detail pages sat built and
    // authorised with nothing linking to them.
    const overview = await getTeacherOverview(ctxAdmin);
    const ids = overview.classes.map((cls) => cls.id).sort();
    expect(ids).toEqual([classAId, classBId].sort());
  });
});

describe("getAttemptReplay — deterministic re-run matches the stored verdict", () => {
  it("re-grades the stored workspace and reproduces a clean PASS", async () => {
    const attempt = await db.activityAttempt.findUniqueOrThrow({
      where: { attemptRunId: "fx-replay-1" },
      select: { id: true },
    });
    const replay = await getAttemptReplay(ctxTeacherOne, attempt.id);
    expect(replay).not.toBeNull();
    expect(replay!.attempt.verdict).toBe("PASS");
    expect(replay!.attempt.starsEarned).toBe(3);
    // The re-run's own event log independently reached the goal with no
    // core/secondary check failures — consistent with the stored PASS,
    // not just an echo of the stored field.
    expect(replay!.runs).toHaveLength(1);
    expect(replay!.runs[0]!.reachedGoal).toBe(true);
    expect(replay!.perVariant).toHaveLength(1);
    expect(replay!.perVariant[0]!.checkFailures).toEqual([]);
    expect(replay!.workspaceJson).toEqual(THREE_STAR_WORKSPACE);
  });

  it("a teacher outside the student's class cannot replay their attempt", async () => {
    const attempt = await db.activityAttempt.findUniqueOrThrow({
      where: { attemptRunId: "fx-replay-1" },
      select: { id: true },
    });
    expect(await getAttemptReplay(ctxTeacherTwo, attempt.id)).toBeNull();
  });

  it("an unknown attempt id resolves to null, not an error", async () => {
    expect(await getAttemptReplay(ctxTeacherOne, "no-such-attempt")).toBeNull();
  });
});

describe("the assignment loop — both halves", () => {
  // The fixture's class A carries one open LEVEL assignment on l1, and
  // studentNormal has completed l1.

  it("shows a student the work their teacher set, with who set it", async () => {
    const ctxStudent = createCtx({ userId: studentNormalId, role: "STUDENT", schoolId });
    const rows = await listMyStudentAssignments(ctxStudent);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Finish level one");
    expect(rows[0]!.totalLevels).toBe(1);
    // This student finished the assigned level, so the card reads as done.
    expect(rows[0]!.completedLevels).toBe(1);
    expect(rows[0]!.done).toBe(true);
    expect(rows[0]!.nextLevelId).toBeNull();
  });

  it("points an unfinished student at the level to play next", async () => {
    const ctxStudent = createCtx({ userId: studentNotStartedId, role: "STUDENT", schoolId });
    const rows = await listMyStudentAssignments(ctxStudent);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.done).toBe(false);
    expect(rows[0]!.completedLevels).toBe(0);
    // A card with nowhere to go is just a reminder; this one leads somewhere.
    expect(rows[0]!.nextLevelId).toBe(l1Id);
  });

  it("shows nothing to a student in another class", async () => {
    const ctxStudent = createCtx({ userId: studentInClassBId, role: "STUDENT", schoolId });
    expect(await listMyStudentAssignments(ctxStudent)).toEqual([]);
  });

  it("hides an assignment once it is closed", async () => {
    const assignment = await db.assignment.findFirstOrThrow({ where: { classId: classAId } });
    await db.assignment.update({ where: { id: assignment.id }, data: { closedAt: new Date() } });
    const ctxStudent = createCtx({ userId: studentNormalId, role: "STUDENT", schoolId });
    expect(await listMyStudentAssignments(ctxStudent)).toEqual([]);
    await db.assignment.update({ where: { id: assignment.id }, data: { closedAt: null } });
  });

  it("tells the teacher how many of the class finished it", async () => {
    const rows = await getClassAssignmentProgress(ctxTeacherOne, classAId);
    expect(rows).toHaveLength(1);
    const roster = await db.classMembership.count({
      where: { classId: classAId, role: "STUDENT" },
    });
    expect(rows[0]!.studentCount).toBe(roster);
    // Only studentNormal completed l1 in the fixture.
    expect(rows[0]!.completedCount).toBe(1);
  });

  it("counts a multi-level assignment only when every level is done", async () => {
    const world = await db.level.findUniqueOrThrow({
      where: { id: l1Id },
      select: { module: { select: { worldId: true } } },
    });
    const created = await db.assignment.create({
      data: {
        schoolId,
        classId: classAId,
        createdById: teacherOneId,
        target: "WORLD",
        worldId: world.module.worldId,
        title: "Finish the whole world",
      },
    });

    const rows = await getClassAssignmentProgress(ctxTeacherOne, classAId);
    const row = rows.find((r) => r.assignmentId === created.id);
    // studentNormal finished l1 but not l2, so partial progress is not done.
    expect(row?.completedCount).toBe(0);

    await db.assignment.delete({ where: { id: created.id } });
  });

  it("is not readable by a teacher who does not teach the class", async () => {
    expect(await getClassAssignmentProgress(ctxTeacherTwo, classAId)).toEqual([]);
  });
});
