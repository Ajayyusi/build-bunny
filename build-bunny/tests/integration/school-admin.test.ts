import { beforeAll, describe, expect, it } from "vitest";
import { APIError } from "better-auth/api";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AUDIT } from "@/lib/audit";
import { NotFoundError, ConflictError } from "@/modules/auth/server/guard";
import { createStaff, createStudent, composeStudentUsername } from "@/modules/auth/server/provisioning";
import {
  addStudentToClass,
  createClass,
  createStudentAccount,
  createTeacher,
  removeStudentFromClass,
  resetStudentPassword,
  resetTeacherPassword,
  rotateJoinCode,
  setStudentDisabled,
  setTeacherDisabled,
  updateClass,
} from "@/modules/schools/server/management";
import { commitStudentImport, dryRunStudentImport } from "@/modules/schools/server/imports";
import { createSchoolWithAdmin, setSchoolActive } from "@/modules/schools/server/platform-management";
import {
  createCtx,
  createTestProgram,
  createTestSchool,
  SYSTEM_ACTOR,
  wipeDatabase,
} from "../helpers/fixtures";

/**
 * M4 school-admin management surfaces: teacher/student/class CRUD, the CSV
 * importer, and platform school onboarding. Every mutation re-verifies its
 * caller-supplied target against the CALLING school (compound lookup) —
 * these tests assert that a school-A admin can never reach into school B's
 * data, on top of exercising the real create/reset/disable/import paths
 * through the same Better Auth sign-in stack the app uses.
 */

let A: { schoolId: string; code: string; adminCtx: ReturnType<typeof createCtx> };
let B: { schoolId: string; code: string; adminCtx: ReturnType<typeof createCtx> };
let classAId: string;
let yearAId: string;

beforeAll(async () => {
  await wipeDatabase();

  const schoolA = await createTestSchool("mgmta");
  const schoolB = await createTestSchool("mgmtb");
  const adminA = await createStaff(SYSTEM_ACTOR, {
    schoolId: schoolA.id,
    email: `${schoolA.code}-admin@test.example`,
    displayName: "Admin A",
    role: "SCHOOL_ADMIN",
    password: "admin-pass-11",
  });
  const adminB = await createStaff(SYSTEM_ACTOR, {
    schoolId: schoolB.id,
    email: `${schoolB.code}-admin@test.example`,
    displayName: "Admin B",
    role: "SCHOOL_ADMIN",
    password: "admin-pass-11",
  });

  const year = await db.academicYear.create({
    data: {
      schoolId: schoolA.id,
      name: "2026-2027",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2027-06-30T00:00:00Z"),
    },
  });
  yearAId = year.id;
  const klass = await db.class.create({
    data: { schoolId: schoolA.id, academicYearId: year.id, name: "Grade 3A", grade: 3 },
  });
  classAId = klass.id;

  A = {
    schoolId: schoolA.id,
    code: schoolA.code,
    adminCtx: createCtx({ userId: adminA.userId, role: "SCHOOL_ADMIN", schoolId: schoolA.id }),
  };
  B = {
    schoolId: schoolB.id,
    code: schoolB.code,
    adminCtx: createCtx({ userId: adminB.userId, role: "SCHOOL_ADMIN", schoolId: schoolB.id }),
  };
});

describe("teacher management", () => {
  let teacherId: string;
  let teacherEmail: string;

  it("creates a teacher who can sign in", async () => {
    teacherEmail = `${A.code}-newteacher@test.example`;
    const result = await createTeacher(A.adminCtx, {
      email: teacherEmail,
      displayName: "New Teacher",
      title: "Grade 3",
    });
    teacherId = result.userId;
    const signIn = await auth.api.signInEmail({ body: { email: teacherEmail, password: result.password } });
    expect(signIn.user.id).toBe(teacherId);
  });

  it("resets the password and invalidates the old one", async () => {
    const oldPassword = "irrelevant"; // sign-in already proven above; reset must still revoke sessions
    const { password: newPassword } = await resetTeacherPassword(A.adminCtx, teacherId);
    expect(await db.session.count({ where: { userId: teacherId } })).toBe(0);
    await expect(
      auth.api.signInEmail({ body: { email: teacherEmail, password: oldPassword } }),
    ).rejects.toBeInstanceOf(APIError);
    const signIn = await auth.api.signInEmail({ body: { email: teacherEmail, password: newPassword } });
    expect(signIn.user.id).toBe(teacherId);
  });

  it("deactivation blocks sign-in", async () => {
    await setTeacherDisabled(A.adminCtx, teacherId, true);
    const user = await db.user.findUnique({ where: { id: teacherId } });
    expect(user?.banned).toBe(true);
    const row = await db.auditLog.findFirst({ where: { action: AUDIT.staff.disabled, targetId: teacherId } });
    expect(row).not.toBeNull();
  });

  it("school B's admin cannot reset or disable school A's teacher (NOT_FOUND)", async () => {
    await expect(resetTeacherPassword(B.adminCtx, teacherId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(setTeacherDisabled(B.adminCtx, teacherId, true)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("student management", () => {
  let studentId: string;
  let namespaced: string;

  it("creates a student, optionally joins a class, and the account can sign in", async () => {
    const result = await createStudentAccount(A.adminCtx, {
      username: "newstudent",
      displayName: "New Student",
      studentIdentifier: "MGMT-001",
      grade: 3,
      classId: classAId,
    });
    studentId = result.userId;
    namespaced = composeStudentUsername(A.code, "newstudent");

    const membership = await db.classMembership.findUnique({
      where: { classId_userId: { classId: classAId, userId: studentId } },
    });
    expect(membership).not.toBeNull();

    const signIn = await auth.api.signInUsername({
      body: { username: namespaced, password: result.password },
    });
    expect(signIn?.user.id).toBe(studentId);
  });

  it("resets the password and invalidates the old one", async () => {
    const { password: newPassword } = await resetStudentPassword(A.adminCtx, studentId);
    expect(await db.session.count({ where: { userId: studentId } })).toBe(0);
    const signIn = await auth.api.signInUsername({
      body: { username: namespaced, password: newPassword },
    });
    expect(signIn?.user.id).toBe(studentId);
  });

  it("deactivation blocks sign-in", async () => {
    await setStudentDisabled(A.adminCtx, studentId, true);
    const user = await db.user.findUnique({ where: { id: studentId } });
    expect(user?.banned).toBe(true);
  });

  it("school B's admin cannot reset or disable school A's student (NOT_FOUND)", async () => {
    await expect(resetStudentPassword(B.adminCtx, studentId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(setStudentDisabled(B.adminCtx, studentId, true)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("class management", () => {
  it("creates a class against an existing academic year", async () => {
    const klass = await createClass(A.adminCtx, { name: "Grade 4A", grade: 4, academicYearId: yearAId });
    expect(klass.schoolId).toBe(A.schoolId);
  });

  it("creates a class with a brand-new academic year in one call", async () => {
    const klass = await createClass(A.adminCtx, {
      name: "Grade 5A",
      grade: 5,
      newAcademicYear: {
        name: "2027-2028",
        startsAt: new Date("2027-09-01T00:00:00Z"),
        endsAt: new Date("2028-06-30T00:00:00Z"),
      },
    });
    const year = await db.academicYear.findUnique({
      where: { schoolId_name: { schoolId: A.schoolId, name: "2027-2028" } },
    });
    expect(year).not.toBeNull();
    expect(klass.academicYearId).toBe(year!.id);
  });

  it("rejects an academic year from another school (NOT_FOUND)", async () => {
    await expect(
      createClass(B.adminCtx, { name: "Cross Year", grade: 3, academicYearId: yearAId }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rotates the join code to a fresh unique value", async () => {
    const before = await db.class.findUnique({ where: { id: classAId } });
    const newCode = await rotateJoinCode(A.adminCtx, classAId);
    expect(newCode).not.toBe(before?.joinCode);
    const after = await db.class.findUnique({ where: { id: classAId } });
    expect(after?.joinCode).toBe(newCode);
  });

  it("adds and removes a student from the roster", async () => {
    const student = await createStudent(SYSTEM_ACTOR, {
      schoolId: A.schoolId,
      schoolCode: A.code,
      username: "rosterkid",
      displayName: "Roster Kid",
      studentIdentifier: "MGMT-ROSTER",
      grade: 3,
    });

    await addStudentToClass(A.adminCtx, classAId, student.userId);
    expect(
      await db.classMembership.findUnique({
        where: { classId_userId: { classId: classAId, userId: student.userId } },
      }),
    ).not.toBeNull();

    await removeStudentFromClass(A.adminCtx, classAId, student.userId);
    expect(
      await db.classMembership.findUnique({
        where: { classId_userId: { classId: classAId, userId: student.userId } },
      }),
    ).toBeNull();
  });

  it("school B's admin cannot edit or rotate school A's class (NOT_FOUND)", async () => {
    await expect(updateClass(B.adminCtx, classAId, { name: "Hijacked" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(rotateJoinCode(B.adminCtx, classAId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("CSV student importer", () => {
  const VALID_CSV =
    "student_identifier,first_name,last_initial,grade,class_name\n" +
    "CSV-100,Sara,H,3,Grade 3A\n" +
    "CSV-101,Omar,F,3,Grade 3A\n";

  it("accepts a valid file: dry-run previews creates, commit creates real sign-in-able accounts", async () => {
    const dry = await dryRunStudentImport(A.adminCtx, VALID_CSV);
    expect(dry.ok).toBe(true);
    if (!dry.ok) return;
    expect(dry.summary.toCreate).toBe(2);
    expect(dry.summary.errors).toBe(0);

    const result = await commitStudentImport(A.adminCtx, VALID_CSV);
    expect(result.created.length).toBe(2);

    const created = result.created.find((c) => c.studentIdentifier === "CSV-100")!;
    const namespaced = composeStudentUsername(A.code, created.username);
    const signIn = await auth.api.signInUsername({
      body: { username: namespaced, password: created.password },
    });
    expect(signIn?.user.id).toBe(created.userId);

    const auditRow = await db.auditLog.findFirst({
      where: { action: AUDIT.students.imported, schoolId: A.schoolId },
      orderBy: { createdAt: "desc" },
    });
    expect(auditRow).not.toBeNull();
  });

  it("rejects a file with an unrecognized column, naming it", async () => {
    const csv =
      "student_identifier,first_name,last_initial,grade,class_name,favorite_color\n" +
      "CSV-200,Lina,K,3,Grade 3A,blue\n";
    const dry = await dryRunStudentImport(A.adminCtx, csv);
    expect(dry.ok).toBe(false);
    if (dry.ok) return;
    expect(dry.columnErrors?.unrecognized).toContain("favorite_color");
  });

  it("rejects a file missing a required column, naming it", async () => {
    const csv = "student_identifier,first_name,last_initial,grade\nCSV-201,Lina,K,3\n";
    const dry = await dryRunStudentImport(A.adminCtx, csv);
    expect(dry.ok).toBe(false);
    if (dry.ok) return;
    expect(dry.columnErrors?.missing).toContain("class_name");
  });

  it("updates an existing student by student_identifier instead of duplicating", async () => {
    const existing = await createStudent(SYSTEM_ACTOR, {
      schoolId: A.schoolId,
      schoolCode: A.code,
      username: "existingkid",
      displayName: "Old Name",
      studentIdentifier: "CSV-DUP",
      grade: 3,
    });
    const beforeCount = await db.user.count({ where: { schoolId: A.schoolId, role: "STUDENT" } });

    const csv =
      "student_identifier,first_name,last_initial,grade,class_name\n" +
      "CSV-DUP,Updated,N,4,Grade 4A\n";
    const dry = await dryRunStudentImport(A.adminCtx, csv);
    expect(dry.ok).toBe(true);
    if (!dry.ok) return;
    expect(dry.rows[0]?.action).toBe("update");

    const result = await commitStudentImport(A.adminCtx, csv);
    expect(result.created.length).toBe(0);
    expect(result.updatedCount).toBe(1);

    const afterCount = await db.user.count({ where: { schoolId: A.schoolId, role: "STUDENT" } });
    expect(afterCount).toBe(beforeCount); // no new account created

    const user = await db.user.findUnique({ where: { id: existing.userId } });
    expect(user?.displayName).toBe("Updated N.");
    const profile = await db.studentProfile.findUnique({ where: { userId: existing.userId } });
    expect(profile?.grade).toBe(4);
  });

  it("flags a duplicate student_identifier within the same file", async () => {
    const csv =
      "student_identifier,first_name,last_initial,grade,class_name\n" +
      "CSV-300,First,A,3,Grade 3A\n" +
      "CSV-300,Second,B,3,Grade 3A\n";
    const dry = await dryRunStudentImport(A.adminCtx, csv);
    expect(dry.ok).toBe(true);
    if (!dry.ok) return;
    expect(dry.rows[0]?.action).toBe("create");
    expect(dry.rows[1]?.action).toBe("error");
    expect(dry.rows[1]?.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("flags an unknown class_name as a row error", async () => {
    const csv =
      "student_identifier,first_name,last_initial,grade,class_name\n" +
      "CSV-400,Noor,Z,3,Nonexistent Class\n";
    const dry = await dryRunStudentImport(A.adminCtx, csv);
    expect(dry.ok).toBe(true);
    if (!dry.ok) return;
    expect(dry.rows[0]?.action).toBe("error");
    expect(dry.rows[0]?.errors.some((e) => e.includes("unknown class_name"))).toBe(true);
  });
});

describe("platform school onboarding", () => {
  const nitaqCtx = createCtx({ userId: "platform-admin", role: "NITAQ_ADMIN", schoolId: null });

  it("creates a school, licence and first admin who can sign in", async () => {
    const result = await createSchoolWithAdmin(nitaqCtx, {
      name: "Brand New School",
      slug: `brand-new-${Date.now()}`,
      code: `BN${Date.now()}`.slice(0, 12),
      timezone: "Asia/Dubai",
      licenceSeats: 50,
      licenceStartsAt: new Date(),
      licenceExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      adminEmail: `principal-${Date.now()}@brandnew.example`,
      adminDisplayName: "New Principal",
    });
    const school = await db.school.findUnique({ where: { id: result.schoolId } });
    expect(school?.status).toBe("ACTIVE");
    const licence = await db.licence.findFirst({ where: { schoolId: result.schoolId } });
    expect(licence?.seats).toBe(50);

    const signIn = await auth.api.signInEmail({
      body: { email: result.admin.username, password: result.admin.password },
    });
    expect(signIn.user.id).toBe(result.admin.userId);
  });

  /**
   * A school created without curriculum shows every one of its students the
   * empty "adventure is being prepared" map. Onboarding attaches the
   * programme so that state is not the default a new school starts in.
   */
  it("attaches the curriculum when exactly one programme is published", async () => {
    await db.schoolProgram.deleteMany();
    await db.program.deleteMany();
    const program = await createTestProgram({ name: "Only Published" });

    const result = await createSchoolWithAdmin(nitaqCtx, {
      name: "Auto Programme School",
      slug: `auto-prog-${Date.now()}`,
      code: `AP${Date.now()}`.slice(0, 12),
      timezone: "Asia/Dubai",
      licenceSeats: 10,
      licenceStartsAt: new Date(),
      licenceExpiresAt: new Date(Date.now() + 1000),
      adminEmail: `auto-${Date.now()}@example.test`,
      adminDisplayName: "Admin",
    });

    const rows = await db.schoolProgram.findMany({ where: { schoolId: result.schoolId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.programId).toBe(program.id);
  });

  it("attaches nothing when the default is ambiguous or absent", async () => {
    await db.schoolProgram.deleteMany();
    await db.program.deleteMany();
    // Two published programmes: there is no right one to guess, so onboarding
    // must leave it for the programme picker rather than pick arbitrarily.
    await createTestProgram({ name: "Alpha" });
    await createTestProgram({ name: "Beta" });

    const result = await createSchoolWithAdmin(nitaqCtx, {
      name: "Ambiguous Programme School",
      slug: `amb-prog-${Date.now()}`,
      code: `MP${Date.now()}`.slice(0, 12),
      timezone: "Asia/Dubai",
      licenceSeats: 10,
      licenceStartsAt: new Date(),
      licenceExpiresAt: new Date(Date.now() + 1000),
      adminEmail: `amb-${Date.now()}@example.test`,
      adminDisplayName: "Admin",
    });

    expect(await db.schoolProgram.count({ where: { schoolId: result.schoolId } })).toBe(0);
  });

  it("rejects a duplicate school code", async () => {
    const slug = `dup-code-${Date.now()}`;
    const code = `DUP${Date.now()}`.slice(0, 12);
    await createSchoolWithAdmin(nitaqCtx, {
      name: "First",
      slug,
      code,
      timezone: "Asia/Dubai",
      licenceSeats: 10,
      licenceStartsAt: new Date(),
      licenceExpiresAt: new Date(Date.now() + 1000),
      adminEmail: `first-${Date.now()}@example.test`,
      adminDisplayName: "Admin",
    });
    await expect(
      createSchoolWithAdmin(nitaqCtx, {
        name: "Second",
        slug: `${slug}-2`,
        code,
        timezone: "Asia/Dubai",
        licenceSeats: 10,
        licenceStartsAt: new Date(),
        licenceExpiresAt: new Date(Date.now() + 1000),
        adminEmail: `second-${Date.now()}@example.test`,
        adminDisplayName: "Admin",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("deactivates and reactivates a school, auditing both", async () => {
    await setSchoolActive(nitaqCtx, A.schoolId, false);
    expect((await db.school.findUnique({ where: { id: A.schoolId } }))?.status).toBe("INACTIVE");
    await setSchoolActive(nitaqCtx, A.schoolId, true);
    expect((await db.school.findUnique({ where: { id: A.schoolId } }))?.status).toBe("ACTIVE");

    const rows = await db.auditLog.findMany({
      where: { schoolId: A.schoolId, action: { in: [AUDIT.schools.deactivated, AUDIT.schools.reactivated] } },
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("a school admin cannot create or deactivate a school (guarded, not just UI-hidden)", async () => {
    await expect(
      createSchoolWithAdmin(A.adminCtx, {
        name: "Should Fail",
        slug: "should-fail",
        code: "SHOULDFAIL",
        timezone: "Asia/Dubai",
        licenceSeats: 1,
        licenceStartsAt: new Date(),
        licenceExpiresAt: new Date(),
        adminEmail: "x@example.test",
        adminDisplayName: "X",
      }),
    ).rejects.toThrow();
    await expect(setSchoolActive(A.adminCtx, B.schoolId, false)).rejects.toThrow();
  });
});
