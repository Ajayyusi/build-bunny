import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { getClassMisconceptions, getClassReflections } from "@/modules/analytics/server/queries";
import { createStaff, createStudent, setAccountDisabled } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { getTeacherCurriculumGuide } from "@/modules/curriculum/server/guide";
import { getModuleWorksheet } from "@/modules/curriculum/server/worksheet";
import {
  createFamilyLinkCore,
  getFamilyLinkStatus,
  revokeFamilyLinksCore,
} from "@/modules/family/server/links";
import { getFamilySummary } from "@/modules/family/server/summary";
import { submitAttempt } from "@/modules/grading/server/submit";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import { saveReflectionCore } from "@/modules/learning/server/play";
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
 * Classroom and family features (brief §6) against real rows: the
 * misconception report groups a class's graded failures into ideas; the
 * curriculum guide lists the published programme for staff only; a family
 * link is created once, shows one child's week, and stops working the
 * moment it is replaced or switched off.
 */

type Node = Record<string, unknown>;
const program = (...types: string[]): unknown => {
  let next: Node | undefined;
  for (let i = types.length - 1; i >= 0; i -= 1) {
    const block: Node = { type: types[i], id: `b${i}` };
    if (next) block["next"] = { block: next };
    next = block;
  }
  return {
    blocks: { languageVersion: 0, blocks: [{ type: "bb_whenStart", id: "hat", ...(next ? { next: { block: next } } : {}) }] },
  };
};

/** Two hops East to the goal; a rock sits South of the start. */
const PAYLOAD = {
  toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnRight" }],
  variants: [{ rows: ["..G", "#.."], start: { x: 0, y: 0, dir: "E" } }],
  checks: [{ id: "reachedGoal", severity: "core" }],
  starCriteria: { threeStarMaxBlocks: 2 },
};
const PASS = program("bb_moveForward", "bb_moveForward");
const BUMP = program("bb_turnRight", "bb_moveForward"); // turns into the rock

let teacherCtx: SessionContext;
let otherTeacherCtx: SessionContext;
const studentCtxs: SessionContext[] = [];
let classId: string;
let levelId: string;
const studentIds: string[] = [];

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Classroom");
  const teacher = await createStaff(SYSTEM_ACTOR, {
    schoolId: school.id,
    email: `${school.code}-t@test.example`,
    displayName: "Class Teacher",
    role: "TEACHER",
    password: "teach-pass-11",
  });
  const other = await createStaff(SYSTEM_ACTOR, {
    schoolId: school.id,
    email: `${school.code}-o@test.example`,
    displayName: "Other Teacher",
    role: "TEACHER",
    password: "teach-pass-12",
  });
  const year = await db.academicYear.create({
    data: {
      schoolId: school.id,
      name: "2026-2027",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2027-06-30T00:00:00Z"),
    },
  });
  const cls = await db.class.create({
    data: { schoolId: school.id, academicYearId: year.id, name: "5B", grade: 5 },
  });
  classId = cls.id;
  await db.classMembership.create({
    data: { schoolId: school.id, classId, userId: teacher.userId, role: "TEACHER" },
  });

  const prog = await createTestProgram({ name: "Classroom Program" });
  const world = await addWorldToProgram(prog.id, 1, { name: "Classroom World" });
  const mod = await createTestModule(world.id, 1);
  const level = await createTestLevel(mod.id, 1, { title: "Two Hops", payload: PAYLOAD, tags: ["sequencing"] });
  levelId = level.id;
  await enableProgramForSchool(school.id, prog.id);

  for (const [i, name] of ["ana", "ben"].entries()) {
    const student = await createStudent(SYSTEM_ACTOR, {
      schoolId: school.id,
      schoolCode: school.code,
      username: `${name}cls`,
      displayName: `${name.toUpperCase()} K.`,
      studentIdentifier: `CL-${i}`,
      grade: 5,
    });
    await db.classMembership.create({
      data: { schoolId: school.id, classId, userId: student.userId, role: "STUDENT" },
    });
    await recomputeUnlocks(student.userId);
    studentIds.push(student.userId);
    studentCtxs.push(createCtx({ userId: student.userId, role: "STUDENT", schoolId: school.id }));
  }
  teacherCtx = createCtx({ userId: teacher.userId, role: "TEACHER", schoolId: school.id });
  otherTeacherCtx = createCtx({ userId: other.userId, role: "TEACHER", schoolId: school.id });
});

describe("misconception report", () => {
  it("is empty before anyone has failed", async () => {
    expect(await getClassMisconceptions(teacherCtx, classId)).toEqual([]);
  });

  it("groups bumps from two children into one idea, naming the level, never a child", async () => {
    for (const ctx of studentCtxs) {
      const result = await submitAttempt(ctx, levelId, { attemptRunId: randomUUID(), workspaceJson: BUMP });
      expect(result.status).toBe(200);
    }
    const report = await getClassMisconceptions(teacherCtx, classId);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ id: "turnDirection", attempts: 2, students: 2 });
    expect(report[0]!.levels).toEqual([
      expect.objectContaining({ levelId, attempts: 2, title: { en: "Two Hops" } }),
    ]);
    expect(JSON.stringify(report)).not.toContain(studentIds[0]);
  });

  it("is unreachable for a teacher who does not teach the class", async () => {
    expect(await getClassMisconceptions(otherTeacherCtx, classId)).toEqual([]);
  });
});

describe("curriculum guide", () => {
  it("lists the published programme with objectives and timing for staff only", async () => {
    const guide = await getTeacherCurriculumGuide(teacherCtx);
    expect(guide).toHaveLength(1);
    expect(guide[0]!.levelCount).toBe(1);
    const level = guide[0]!.modules[0]!.levels[0]!;
    expect(level).toMatchObject({ id: levelId, tags: ["sequencing"], title: { en: "Two Hops" } });
    expect(level).not.toHaveProperty("payload");
    expect(level).not.toHaveProperty("hints");
    expect(await getTeacherCurriculumGuide(studentCtxs[0]!)).toEqual([]);
  });
});

describe("family link", () => {
  it("only the child's own teacher may create one; the link shows one child's week", async () => {
    await expect(createFamilyLinkCore(otherTeacherCtx, { studentUserId: studentIds[0]! })).rejects.toThrow();

    // Ana passes this week.
    const pass = await submitAttempt(studentCtxs[0]!, levelId, { attemptRunId: randomUUID(), workspaceJson: PASS });
    expect(pass.status).toBe(200);

    const { token } = await createFamilyLinkCore(teacherCtx, { studentUserId: studentIds[0]! });
    const stored = await db.familyLink.findFirst({ where: { studentUserId: studentIds[0]! } });
    expect(stored?.tokenHash).not.toBe(token); // only a hash is kept
    expect(await getFamilyLinkStatus(teacherCtx, studentIds[0]!)).toMatchObject({ active: true });

    const summary = await getFamilySummary(token);
    expect(summary).not.toBeNull();
    expect(summary!.displayName).toBe("ANA K.");
    expect(summary!.thisWeek.levelsCompleted).toBe(1);
    expect(summary!.thisWeek.levelTitles).toEqual([{ en: "Two Hops" }]);
    expect(summary!.worlds[0]).toMatchObject({ completed: 1, total: 1, powerEarned: true });
    // Nothing about another child, attempts or hints.
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain(studentIds[1]!);
    expect(serialized).not.toContain("attempt");
    expect(await getFamilyLinkStatus(teacherCtx, studentIds[0]!)).toMatchObject({ active: true });
    const viewed = await db.familyLink.findFirst({ where: { studentUserId: studentIds[0]!, revokedAt: null } });
    expect(viewed?.lastViewedAt).not.toBeNull();
  });

  it("disabling a child switches their family link off, and a view as someone else can't create one", async () => {
    const { token } = await createFamilyLinkCore(teacherCtx, { studentUserId: studentIds[0]! });
    expect(await getFamilySummary(token)).not.toBeNull();
    await setAccountDisabled(SYSTEM_ACTOR, { userId: studentIds[0]!, schoolId: studentCtxs[0]!.schoolId, isStudent: true }, true);
    expect(await getFamilySummary(token)).toBeNull();
    await setAccountDisabled(SYSTEM_ACTOR, { userId: studentIds[0]!, schoolId: studentCtxs[0]!.schoolId, isStudent: true }, false);
    // Re-enabling does not bring the old link back; the teacher makes a new one.
    expect(await getFamilySummary(token)).toBeNull();

    const impersonating = { ...teacherCtx, impersonatedBy: "platform-admin" };
    await expect(createFamilyLinkCore(impersonating, { studentUserId: studentIds[0]! })).rejects.toThrow();
  });

  it("a new link replaces the old one, and switching off ends it", async () => {
    const first = await createFamilyLinkCore(teacherCtx, { studentUserId: studentIds[1]! });
    const second = await createFamilyLinkCore(teacherCtx, { studentUserId: studentIds[1]! });
    expect(await getFamilySummary(first.token)).toBeNull();
    expect(await getFamilySummary(second.token)).not.toBeNull();

    await revokeFamilyLinksCore(teacherCtx, { studentUserId: studentIds[1]! });
    expect(await getFamilySummary(second.token)).toBeNull();
    expect(await getFamilyLinkStatus(teacherCtx, studentIds[1]!)).toMatchObject({ active: false });
  });

  it("unknown, malformed and expired links are all simply inactive", async () => {
    expect(await getFamilySummary("not-a-real-token-at-all-000000")).toBeNull();
    expect(await getFamilySummary("../../etc")).toBeNull();
    const { token } = await createFamilyLinkCore(teacherCtx, { studentUserId: studentIds[1]! });
    const later = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000);
    expect(await getFamilySummary(token, later)).toBeNull();
  });
});

describe("one-tap reflections", () => {
  it("say nothing until five children have answered, then show only a rough band", async () => {
    await saveReflectionCore(studentCtxs[0]!, { levelId, feeling: "EASY" });
    // Changing your mind replaces the answer; it never counts twice.
    await saveReflectionCore(studentCtxs[0]!, { levelId, feeling: "TRICKY" });
    await saveReflectionCore(studentCtxs[1]!, { levelId, feeling: "TRICKY" });
    expect(await db.levelReflection.count({ where: { levelId } })).toBe(2);

    const schoolId = studentCtxs[0]!.schoolId!;
    const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
    const extra: string[] = [];
    const feelings = ["JUST_RIGHT", "EASY", "TRICKY"] as const;
    for (const [i, name] of ["cam", "dan", "eva"].entries()) {
      const kid = await createStudent(SYSTEM_ACTOR, {
        schoolId,
        schoolCode: school.code,
        username: `${name}cls`,
        displayName: `${name.toUpperCase()} K.`,
        studentIdentifier: `CL-${i + 2}`,
        grade: 5,
      });
      await db.classMembership.create({ data: { schoolId, classId, userId: kid.userId, role: "STUDENT" } });
      await recomputeUnlocks(kid.userId);
      extra.push(kid.userId);
      const ctx = createCtx({ userId: kid.userId, role: "STUDENT", schoolId });
      if (i === 2) {
        // Four answers: still nothing to show.
        expect(await getClassReflections(teacherCtx, classId)).toEqual([]);
      }
      await saveReflectionCore(ctx, { levelId, feeling: feelings[i]! });
    }

    // Today's answers don't show until tomorrow (no watching one child move
    // a band); move them to yesterday to see the settled report.
    expect(await getClassReflections(teacherCtx, classId)).toEqual([]);
    await db.levelReflection.updateMany({
      where: { levelId },
      data: { updatedAt: new Date(Date.now() - 36 * 60 * 60 * 1000) },
    });

    // 3 of 5 tricky → "most"; no counts, no child ids.
    const report = await getClassReflections(teacherCtx, classId);
    expect(report).toEqual([{ levelId, title: { en: "Two Hops" }, worldName: expect.anything(), band: "most" }]);
    const serialized = JSON.stringify(report);
    for (const id of [...studentIds, ...extra]) expect(serialized).not.toContain(id);
    expect(await getClassReflections(otherTeacherCtx, classId)).toEqual([]);
  });

  it("a level the child cannot open cannot be reflected on", async () => {
    await expect(
      saveReflectionCore(studentCtxs[0]!, { levelId: randomUUID(), feeling: "EASY" }),
    ).rejects.toThrow();
  });
});

describe("printable worksheet", () => {
  it("lays out the published board for staff, and nothing for a child", async () => {
    const { moduleId } = await db.level.findUniqueOrThrow({ where: { id: levelId }, select: { moduleId: true } });
    const sheet = await getModuleWorksheet(teacherCtx, moduleId);
    expect(sheet).not.toBeNull();
    expect(sheet!.items).toEqual([
      expect.objectContaining({
        kind: "grid",
        levelId,
        title: { en: "Two Hops" },
        boards: [{ rows: ["..G", "#.."], start: { x: 0, y: 0, dir: "E" } }],
        blocks: ["bb_moveForward", "bb_turnRight"],
        lines: 8,
      }),
    ]);
    expect(await getModuleWorksheet(studentCtxs[0]!, moduleId)).toBeNull();
    expect(await getModuleWorksheet(teacherCtx, randomUUID())).toBeNull();
  });
});
