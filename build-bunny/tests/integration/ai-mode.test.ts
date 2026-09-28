import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { getStudentDetail } from "@/modules/analytics/server/queries";
import { NotFoundError } from "@/modules/auth/server/guard";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { setMyAiModeCore, setStudentAiModeCore } from "@/modules/students/server/ai-mode";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import {
  addWorldToProgram,
  createCtx,
  createTestLevel,
  createTestModule,
  createTestProgram,
  createTestSchool,
  SYSTEM_ACTOR,
  wipeDatabase,
} from "../helpers/fixtures";

/**
 * Grade range modes: the child and their teacher (or the school admin) can
 * switch; nobody else can; and switching never touches progress.
 */

let kid: SessionContext;
let teacher: SessionContext;
let otherTeacher: SessionContext;
let admin: SessionContext;
let foreignAdmin: SessionContext;
let levelId: string;

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Modes");
  const other = await createTestSchool("Elsewhere");
  const staff = async (schoolId: string, code: string, role: "TEACHER" | "SCHOOL_ADMIN", name: string) =>
    createStaff(SYSTEM_ACTOR, { schoolId, email: `${code}-${name}@test.example`, displayName: name, role, password: "mode-pass-51" });
  const t = await staff(school.id, school.code, "TEACHER", "t");
  const t2 = await staff(school.id, school.code, "TEACHER", "t2");
  const a = await staff(school.id, school.code, "SCHOOL_ADMIN", "a");
  const fa = await staff(other.id, other.code, "SCHOOL_ADMIN", "fa");
  const s = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "modekid",
    displayName: "Mode Kid",
    studentIdentifier: "MODE-1",
    grade: 3,
  });
  const year = await db.academicYear.create({
    data: { schoolId: school.id, name: "2026-2027", startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-06-30T00:00:00Z") },
  });
  const cls = await db.class.create({ data: { schoolId: school.id, academicYearId: year.id, name: "3B", grade: 3 } });
  await db.classMembership.createMany({
    data: [
      { schoolId: school.id, classId: cls.id, userId: t.userId, role: "TEACHER" },
      { schoolId: school.id, classId: cls.id, userId: s.userId, role: "STUDENT" },
    ],
  });
  const program = await createTestProgram({ name: "Modes" });
  const world = await addWorldToProgram(program.id, 1, { name: "W" });
  levelId = (await createTestLevel((await createTestModule(world.id, 1)).id, 1)).id;
  kid = createCtx({ userId: s.userId, role: "STUDENT", schoolId: school.id });
  teacher = createCtx({ userId: t.userId, role: "TEACHER", schoolId: school.id });
  otherTeacher = createCtx({ userId: t2.userId, role: "TEACHER", schoolId: school.id });
  admin = createCtx({ userId: a.userId, role: "SCHOOL_ADMIN", schoolId: school.id });
  foreignAdmin = createCtx({ userId: fa.userId, role: "SCHOOL_ADMIN", schoolId: other.id });
});

const stored = async () => (await db.studentProfile.findUniqueOrThrow({ where: { userId: kid.userId } })).aiMode;

describe("switching the AI mode", () => {
  it("the child switches their own, and the snapshot carries it", async () => {
    expect((await getMyStudentSnapshot(kid))?.aiMode).toBeNull();
    await setMyAiModeCore(kid, "older");
    expect(await stored()).toBe("OLDER");
    expect((await getMyStudentSnapshot(kid))?.aiMode).toBe("OLDER");
    await setMyAiModeCore(kid, "auto");
    expect(await stored()).toBeNull();
    // Viewing as the child changes nothing.
    await setMyAiModeCore({ ...kid, impersonatedBy: "platform-admin" }, "older");
    expect(await stored()).toBeNull();
  });

  it("their teacher and the school admin can set it; the teacher page shows it", async () => {
    await setStudentAiModeCore(teacher, { studentUserId: kid.userId, choice: "older" });
    expect(await stored()).toBe("OLDER");
    expect(await getStudentDetail(teacher, kid.userId)).toMatchObject({ aiModeChoice: "older", aiMode: "older", grade: 3 });
    await setStudentAiModeCore(admin, { studentUserId: kid.userId, choice: "auto" });
    expect(await getStudentDetail(admin, kid.userId)).toMatchObject({ aiModeChoice: "auto", aiMode: "younger" });
    expect(await db.auditLog.count({ where: { action: "student.ai_mode_set", targetId: kid.userId } })).toBe(2);
  });

  it("nobody else can", async () => {
    await expect(setStudentAiModeCore(otherTeacher, { studentUserId: kid.userId, choice: "older" })).rejects.toThrow(NotFoundError);
    await expect(setStudentAiModeCore(foreignAdmin, { studentUserId: kid.userId, choice: "older" })).rejects.toThrow(NotFoundError);
    await expect(setStudentAiModeCore(kid, { studentUserId: kid.userId, choice: "older" })).rejects.toThrow(NotFoundError);
    expect(await stored()).toBeNull();
  });

  it("never touches progress", async () => {
    await db.studentProgress.create({
      data: { schoolId: kid.schoolId!, studentUserId: kid.userId, levelId, status: "COMPLETED", stars: 3 },
    });
    const before = await db.studentProgress.findMany({ where: { studentUserId: kid.userId } });
    const profileBefore = await db.studentProfile.findUniqueOrThrow({ where: { userId: kid.userId } });
    await setMyAiModeCore(kid, "younger");
    await setStudentAiModeCore(teacher, { studentUserId: kid.userId, choice: "older" });
    expect(await db.studentProgress.findMany({ where: { studentUserId: kid.userId } })).toEqual(before);
    const profileAfter = await db.studentProfile.findUniqueOrThrow({ where: { userId: kid.userId } });
    expect({ ...profileAfter, aiMode: null, updatedAt: null }).toEqual({ ...profileBefore, aiMode: null, updatedAt: null });
  });
});
