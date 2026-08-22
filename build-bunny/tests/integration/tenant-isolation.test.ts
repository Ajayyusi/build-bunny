import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  getPlatformOverview,
  listSchools,
} from "@/modules/schools/server/platform-queries";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import type { AdventureState } from "@/modules/learning/server/adventure";
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
 * Plan §0.1-11: the two-school isolation rig. Every module's queries.ts must
 * export a `tenantScopedQueries` registry; this suite globs ALL of them so a
 * new module's queries are automatically pulled under test. A registered
 * query with no explicit assertion case below fails (todo-style) — adding a
 * query forces a test update, silently passing is impossible.
 */

type TenantQuery = (ctx: SessionContext, arg?: unknown) => Promise<unknown>;

const queryModules = import.meta.glob<Record<string, unknown>>(
  "../../src/modules/*/server/queries.ts",
  { eager: true },
);

interface RegistryEntry {
  modulePath: string;
  name: string;
  query: TenantQuery;
}

const registryEntries: RegistryEntry[] = [];
for (const [modulePath, mod] of Object.entries(queryModules)) {
  const registry = mod["tenantScopedQueries"];
  if (!registry || typeof registry !== "object") continue; // completeness suite reports it
  for (const [name, fn] of Object.entries(registry)) {
    if (typeof fn !== "function") continue;
    registryEntries.push({ modulePath, name, query: fn as TenantQuery });
  }
}

interface SchoolFixture {
  school: { id: string; slug: string; code: string };
  adminId: string;
  teacherId: string;
  yearId: string;
  classId: string;
  studentIds: [string, string];
}

async function seedSchool(prefix: string): Promise<SchoolFixture> {
  const school = await createTestSchool(prefix);
  const admin = await createStaff(SYSTEM_ACTOR, {
    schoolId: school.id,
    email: `${school.code}-admin@test.example`,
    displayName: `${prefix} Admin`,
    role: "SCHOOL_ADMIN",
    password: "admin-pass-11",
  });
  const teacher = await createStaff(SYSTEM_ACTOR, {
    schoolId: school.id,
    email: `${school.code}-teacher@test.example`,
    displayName: `${prefix} Teacher`,
    role: "TEACHER",
    password: "teach-pass-11",
  });
  const year = await db.academicYear.create({
    data: {
      schoolId: school.id,
      name: "2026-2027",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2027-06-30T00:00:00Z"),
    },
  });
  const klass = await db.class.create({
    data: {
      schoolId: school.id,
      academicYearId: year.id,
      name: "Grade 3A",
      grade: 3,
    },
  });
  await db.classMembership.create({
    data: {
      schoolId: school.id,
      classId: klass.id,
      userId: teacher.userId,
      role: "TEACHER",
    },
  });
  // Same usernames in both schools on purpose: the namespace ({code}__{name})
  // is what keeps them distinct — a silent collision would fail seeding here.
  const studentOne = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "star",
    displayName: `${prefix} Student One`,
    studentIdentifier: `${prefix}-001`,
    grade: 3,
  });
  const studentTwo = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "moon",
    displayName: `${prefix} Student Two`,
    studentIdentifier: `${prefix}-002`,
    grade: 3,
  });
  for (const studentId of [studentOne.userId, studentTwo.userId]) {
    await db.classMembership.create({
      data: {
        schoolId: school.id,
        classId: klass.id,
        userId: studentId,
        role: "STUDENT",
      },
    });
  }
  await audit({
    action: AUDIT.classes.created,
    actorUserId: admin.userId,
    actorRole: "SCHOOL_ADMIN",
    schoolId: school.id,
    targetType: "class",
    targetId: klass.id,
  });
  return {
    school: { id: school.id, slug: school.slug, code: school.code },
    adminId: admin.userId,
    teacherId: teacher.userId,
    yearId: year.id,
    classId: klass.id,
    studentIds: [studentOne.userId, studentTwo.userId],
  };
}

let A: SchoolFixture;
let B: SchoolFixture;
let ctxA: SessionContext; // SCHOOL_ADMIN of school A — the attacker's viewpoint
let teacherCtxA: SessionContext;
let studentCtxA: SessionContext;
let studentCtxB: SessionContext;
let ctxB: SessionContext; // SCHOOL_ADMIN of school B
let teacherCtxB: SessionContext; // the ORIGINAL teacher of school B (owns B.classId)
let teacherTwoCtxB: SessionContext; // a SECOND teacher in school B (owns classTwoBId)
let nitaqCtx: SessionContext;

// M2 curriculum fixture: content is platform-GLOBAL — the isolation property
// for learning queries is that progress/stars come only from the calling
// student's own rows, never from another school's student on the same levels.
let programAId: string;
let levelOneId: string;
let levelTwoId: string;

// M4 certificates/achievements fixture — see beforeAll.
let certAId: string;
let feedbackAId: string;
let certBId: string;

// M4 teacher-analytics fixture (analytics/assignments modules) — a SECOND
// teacher + class INSIDE school A, so isolation cases can prove teacher A
// cannot reach teacher B's class/students even within the SAME school, not
// just across schools.
let teacherTwoBId: string;
let classTwoBId: string;
let studentInClassTwoId: string;
let attemptAId: string;

beforeAll(async () => {
  await wipeDatabase();
  A = await seedSchool("Alpha");
  B = await seedSchool("Beta");

  // Published program with one world/module/2 levels, enabled for school A.
  const programA = await createTestProgram({ name: "Foundations A" });
  programAId = programA.id;
  const world = await addWorldToProgram(programA.id, 1);
  const mod = await createTestModule(world.id, 1);
  const levelOne = await createTestLevel(mod.id, 1, { title: "First Hop" });
  const levelTwo = await createTestLevel(mod.id, 2, { title: "Second Hop" });
  levelOneId = levelOne.id;
  levelTwoId = levelTwo.id;
  await enableProgramForSchool(A.school.id, programA.id);

  // School B runs a DIFFERENT program...
  const programB = await createTestProgram({ name: "Foundations B" });
  await addWorldToProgram(programB.id, 1);
  await enableProgramForSchool(B.school.id, programB.id);

  // ...but its student holds full-star COMPLETED rows on program A's global
  // levels. Those rows must never surface in school A's adventure state.
  for (const levelId of [levelOneId, levelTwoId]) {
    await db.studentProgress.create({
      data: {
        schoolId: B.school.id,
        studentUserId: B.studentIds[0],
        levelId,
        status: "COMPLETED",
        stars: 3,
        unlockSource: "SEED",
      },
    });
  }

  await recomputeUnlocks(A.studentIds[0]);

  // Certificates: one WORLD_COMPLETION row per school on the SAME global
  // world id (mirroring the cross-school progress fixture above) — proves
  // Certificate isolation comes from schoolId, not from the world being
  // different. Direct writes (not the real issuance path — that has its own
  // dedicated suite in certificates.test.ts).
  const certA = await db.certificate.create({
    data: {
      schoolId: A.school.id,
      studentUserId: A.studentIds[0],
      kind: "WORLD_COMPLETION",
      worldId: world.id,
      serial: "BB-2026-AAAAAA",
      verifySlug: "isolation-test-verify-slug-a",
      studentName: "Alpha Student One",
      schoolName: "Alpha Test School",
      title: { en: "Test World" },
      starsEarned: 6,
      levelsCount: 2,
    },
  });
  const certB = await db.certificate.create({
    data: {
      schoolId: B.school.id,
      studentUserId: B.studentIds[0],
      kind: "WORLD_COMPLETION",
      worldId: world.id,
      serial: "BB-2026-BBBBBB",
      verifySlug: "isolation-test-verify-slug-b",
      studentName: "Beta Student One",
      schoolName: "Beta Test School",
      title: { en: "Test World" },
      starsEarned: 6,
      levelsCount: 2,
    },
  });
  certAId = certA.id;
  certBId = certB.id;

  // Teacher feedback: one message per school, each addressed to that
  // school's own student, so the isolation cases have both sides to check.
  const feedbackA = await db.teacherFeedback.create({
    data: {
      schoolId: A.school.id,
      studentUserId: A.studentIds[0],
      teacherUserId: A.teacherId,
      levelId: levelOneId,
      body: "School A feedback",
    },
  });
  feedbackAId = feedbackA.id;
  await db.teacherFeedback.create({
    data: {
      schoolId: B.school.id,
      studentUserId: B.studentIds[0],
      teacherUserId: B.teacherId,
      levelId: levelOneId,
      body: "School B feedback",
    },
  });

  // Achievements: the definition is platform-global (visible to both
  // schools), but the EARNED join must isolate — only school A's student
  // earned it.
  const achievement = await db.achievement.create({
    data: {
      slug: "isolation-test-badge",
      name: { en: "Isolation Badge" },
      description: { en: "For isolation testing" },
      icon: "🏅",
      criteria: { type: "FIRST_PASS" },
      order: 1,
    },
  });
  await db.studentAchievement.create({
    data: { schoolId: A.school.id, studentUserId: A.studentIds[0], achievementId: achievement.id },
  });

  // ── M4 teacher-analytics fixture: a SECOND teacher + class inside school B
  // (not A) — school A's teacher/student/class counts are asserted exactly
  // elsewhere in this file (listTeachers/listStudents/listClasses/
  // getSchoolProgressReport), so growing A's roster would break those. School
  // B's roster is only ever leak-checked ("must not appear"), never counted,
  // so it is the safe place to add a same-school second-teacher fixture.
  const teacherTwoB = await createStaff(SYSTEM_ACTOR, {
    schoolId: B.school.id,
    email: `${B.school.code}-teacher2@test.example`,
    displayName: "Beta Teacher Two",
    role: "TEACHER",
    password: "teach-pass-22",
  });
  teacherTwoBId = teacherTwoB.userId;
  const classTwoB = await db.class.create({
    data: { schoolId: B.school.id, academicYearId: B.yearId, name: "Grade 3B", grade: 3 },
  });
  classTwoBId = classTwoB.id;
  await db.classMembership.create({
    data: { schoolId: B.school.id, classId: classTwoB.id, userId: teacherTwoB.userId, role: "TEACHER" },
  });
  const studentInClassTwo = await createStudent(SYSTEM_ACTOR, {
    schoolId: B.school.id,
    schoolCode: B.school.code,
    username: "comet",
    displayName: "Beta Student Three",
    studentIdentifier: "Beta-003",
    grade: 3,
  });
  studentInClassTwoId = studentInClassTwo.userId;
  await db.classMembership.create({
    data: {
      schoolId: B.school.id,
      classId: classTwoB.id,
      userId: studentInClassTwo.userId,
      role: "STUDENT",
    },
  });

  // A NORMAL attempt for A.studentIds[0] on the shared level-one fixture —
  // direct write (not the real submit pipeline, which has its own suite)
  // just to give getAttemptReplay something to look up and re-grade.
  const attemptA = await db.activityAttempt.create({
    data: {
      attemptRunId: "isolation-test-attempt-a",
      schoolId: A.school.id,
      studentUserId: A.studentIds[0],
      levelId: levelOneId,
      levelVersion: 1,
      engineVersion: "1.0.0",
      kind: "NORMAL",
      workspaceJson: {},
      generatedCode: "",
      resultSummary: {},
      verdict: "ERROR",
      starsEarned: 0,
    },
  });
  attemptAId = attemptA.id;

  ctxA = createCtx({
    userId: A.adminId,
    role: "SCHOOL_ADMIN",
    schoolId: A.school.id,
  });
  teacherCtxA = createCtx({
    userId: A.teacherId,
    role: "TEACHER",
    schoolId: A.school.id,
  });
  studentCtxA = createCtx({
    userId: A.studentIds[0],
    role: "STUDENT",
    schoolId: A.school.id,
  });
  studentCtxB = createCtx({
    userId: B.studentIds[0],
    role: "STUDENT",
    schoolId: B.school.id,
  });
  ctxB = createCtx({
    userId: B.adminId,
    role: "SCHOOL_ADMIN",
    schoolId: B.school.id,
  });
  teacherCtxB = createCtx({
    userId: B.teacherId,
    role: "TEACHER",
    schoolId: B.school.id,
  });
  teacherTwoCtxB = createCtx({
    userId: teacherTwoBId,
    role: "TEACHER",
    schoolId: B.school.id,
  });
  nitaqCtx = createCtx({
    userId: "platform-admin",
    role: "NITAQ_ADMIN",
    schoolId: null,
  });
});

/** Every identifier that must NEVER appear in a school-A-scoped result. */
function foreignIdentifiers(): string[] {
  return [
    B.school.id,
    B.school.slug,
    B.school.code,
    B.adminId,
    B.teacherId,
    B.yearId,
    B.classId,
    ...B.studentIds,
  ];
}

/** Deep-scan a query result's JSON for any school B identifier. */
function expectNoForeignIds(value: unknown, queryName: string): void {
  const json = JSON.stringify(value) ?? "";
  for (const id of foreignIdentifiers()) {
    expect(
      json.includes(id),
      `query "${queryName}" leaked school B identifier "${id}" — fix the query's tenant scoping and add explicit isolation assertions for it`,
    ).toBe(false);
  }
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  expect(Array.isArray(value)).toBe(true);
  return value as Array<Record<string, unknown>>;
}

async function assertQueryIsolated(entry: RegistryEntry): Promise<void> {
  const { name, query } = entry;
  switch (name) {
    case "getSchoolSummary": {
      const summary = (await query(ctxA)) as { id: string } | null;
      expect(summary).not.toBeNull();
      expect(summary?.id).toBe(A.school.id);
      expectNoForeignIds(summary, name);
      break;
    }
    case "getLicenceNotice": {
      // A healthy school has nothing to warn about. Fixture schools get a
      // 1000-seat licence running for a year, so this must be silent —
      // a banner that is always on is a banner nobody reads.
      expect(await query(ctxA)).toBeNull();

      // Force school A's licence close to expiry and confirm the notice
      // describes A ONLY: A's seat count, never B's roster. Restored
      // afterwards so the surrounding suite still sees a healthy school.
      const licence = await db.licence.findFirstOrThrow({ where: { schoolId: A.school.id } });
      const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await db.licence.update({ where: { id: licence.id }, data: { expiresAt: soon } });
      try {
        const notice = (await query(ctxA)) as {
          kind: string;
          daysRemaining: number | null;
          seatsUsed: number;
        } | null;
        expect(notice?.kind).toBe("EXPIRING_SOON");
        expect(notice?.daysRemaining).toBeLessThanOrEqual(5);
        // School A has exactly two students; B's must not be counted.
        expect(notice?.seatsUsed).toBe(A.studentIds.length);
        expectNoForeignIds(notice, name);
        // School B is untouched by A's expiry.
        expect(await query(ctxB)).toBeNull();
      } finally {
        await db.licence.update({
          where: { id: licence.id },
          data: { expiresAt: licence.expiresAt },
        });
      }
      break;
    }
    case "listTeachers": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBe(1);
      for (const row of rows) expect(row["id"]).toBe(A.teacherId);
      expectNoForeignIds(rows, name);
      break;
    }
    case "listStudents": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBe(2);
      for (const row of rows) {
        expect(A.studentIds).toContain(row["id"]);
        expect(B.studentIds).not.toContain(row["id"]);
      }
      expectNoForeignIds(rows, name);
      break;
    }
    case "getStudentDetail": {
      // Two modules export a same-named query: schools/server/queries.ts
      // (m1, admin roster read) and analytics/server/teacher.ts (m4, teacher
      // analytics) — same registry key, different shape, so this case
      // branches by module.
      if (entry.modulePath.includes("/analytics/")) {
        // Cross-school: teacher A can never reach a school-B student.
        expect(await query(teacherCtxA, B.studentIds[0])).toBeNull();
        const own = (await query(teacherCtxA, A.studentIds[0])) as { studentUserId: string } | null;
        expect(own?.studentUserId).toBe(A.studentIds[0]);
        expectNoForeignIds(own, name);
        // Same school, different teacher: B.teacherId (teacher B) must NOT
        // reach a student who belongs only to teacherTwoB's class.
        expect(await query(teacherCtxB, studentInClassTwoId)).toBeNull();
        // SCHOOL_ADMIN may reach any student in their OWN school, including
        // one taught by a different teacher than the school's first.
        const viaAdmin = (await query(ctxB, studentInClassTwoId)) as { studentUserId: string } | null;
        expect(viaAdmin?.studentUserId).toBe(studentInClassTwoId);
        break;
      }
      // A foreign student id must resolve to nothing, not an error the UI
      // could distinguish from "does not exist".
      expect(await query(ctxA, B.studentIds[0])).toBeNull();
      const own = (await query(ctxA, A.studentIds[0])) as { id: string } | null;
      expect(own?.id).toBe(A.studentIds[0]);
      expectNoForeignIds(own, name);
      break;
    }
    case "getClassMatrix": {
      // Cross-school: teacher A can never reach school B's class.
      expect(await query(teacherCtxA, B.classId)).toBeNull();
      const own = (await query(teacherCtxA, A.classId)) as { classId: string } | null;
      expect(own?.classId).toBe(A.classId);
      expectNoForeignIds(own, name);
      // Same school, different teacher: teacher B (B.teacherId) must NOT
      // reach teacherTwoB's class, even though it is in their own school.
      expect(await query(teacherCtxB, classTwoBId)).toBeNull();
      // SCHOOL_ADMIN: any class in their OWN school, including the second
      // teacher's class — but never a foreign school's class.
      const viaAdmin = (await query(ctxB, classTwoBId)) as { classId: string } | null;
      expect(viaAdmin?.classId).toBe(classTwoBId);
      expect(await query(ctxA, classTwoBId)).toBeNull();
      break;
    }
    case "getClassHardestLevels": {
      // Same access rule as the matrix it sits beside: a foreign class is
      // not "empty", it is unreachable — and an empty array is the only
      // safe answer, since leaking WHICH levels another school struggles
      // with would still be a cross-tenant read.
      expect(await query(teacherCtxA, B.classId)).toEqual([]);
      expect(await query(teacherCtxB, classTwoBId)).toEqual([]);
      const own = await query(teacherCtxA, A.classId);
      expect(Array.isArray(own)).toBe(true);
      expectNoForeignIds(own, name);
      // SCHOOL_ADMIN reaches any class in their own school, never another's.
      expect(Array.isArray(await query(ctxB, classTwoBId))).toBe(true);
      expect(await query(ctxA, classTwoBId)).toEqual([]);
      break;
    }
    case "getTeacherOverview": {
      const overview = (await query(teacherCtxA)) as { classes: { id: string }[] };
      expect(overview.classes.map((c) => c.id)).toEqual([A.classId]);
      expectNoForeignIds(overview, name);
      // A SCHOOL_ADMIN has no TEACHER memberships of their own — honest
      // empty result, not an error and not every class in the school.
      const viaAdmin = (await query(ctxA)) as { classes: unknown[] };
      expect(viaAdmin.classes).toEqual([]);
      // Same-school, different-teacher: teacherTwoB's overview shows ONLY
      // their own class (classTwoB), never B.teacherId's class.
      const overviewTwo = (await query(teacherTwoCtxB)) as { classes: { id: string }[] };
      expect(overviewTwo.classes.map((c) => c.id)).toEqual([classTwoBId]);
      break;
    }
    case "getSchoolAnalytics": {
      // SCHOOL_ADMIN only — a TEACHER or STUDENT session gets null (defense
      // in depth on top of the page-level requireRole guard).
      expect(await query(teacherCtxA)).toBeNull();
      expect(await query(studentCtxA)).toBeNull();
      const analytics = (await query(ctxA)) as {
        certificatesIssued: number;
        byClass: { classId: string }[];
      } | null;
      expect(analytics).not.toBeNull();
      // Matches the certA fixture below (one certificate, school A only).
      expect(analytics!.certificatesIssued).toBe(1);
      expect(analytics!.byClass.map((c) => c.classId)).toEqual([A.classId]);
      expectNoForeignIds(analytics, name);
      break;
    }
    case "getAttemptReplay": {
      expect(await query(teacherCtxA, "no-such-attempt")).toBeNull();
      const own = (await query(teacherCtxA, attemptAId)) as { attempt: { studentUserId: string } } | null;
      expect(own?.attempt.studentUserId).toBe(A.studentIds[0]);
      expectNoForeignIds(own, name);
      // Cross-school teacher can never replay another school's attempt.
      expect(await query(teacherCtxB, attemptAId)).toBeNull();
      break;
    }
    case "listMyAssignments": {
      // No assignments seeded — the isolation property is an honest empty
      // array (never every class's assignments) for a teacher with none.
      const rows = asRows(await query(teacherCtxA));
      expect(rows.length).toBe(0);
      break;
    }
    case "listMyStudentAssignments": {
      // A student only ever sees assignments for their own classes, and
      // staff sessions get nothing from this reader at all.
      expect(asRows(await query(studentCtxA))).toEqual([]);
      expect(asRows(await query(studentCtxB))).toEqual([]);
      expect(asRows(await query(teacherCtxA))).toEqual([]);
      expect(asRows(await query(ctxA))).toEqual([]);
      break;
    }
    case "getClassAssignmentProgress": {
      // Same access rule as the assignment list beside it: a class in
      // another school, or another teacher's class, is unreachable rather
      // than empty-but-real.
      expect(asRows(await query(teacherCtxA, B.classId))).toEqual([]);
      expect(asRows(await query(teacherCtxB, classTwoBId))).toEqual([]);
      const own = await query(teacherCtxA, A.classId);
      expect(Array.isArray(own)).toBe(true);
      expectNoForeignIds(own, name);
      // SCHOOL_ADMIN may read any class in their own school, never another's.
      expect(Array.isArray(await query(ctxB, classTwoBId))).toBe(true);
      expect(asRows(await query(ctxA, classTwoBId))).toEqual([]);
      break;
    }
    case "listClassAssignments": {
      const ownRows = asRows(await query(teacherCtxA, A.classId));
      expect(ownRows.length).toBe(0);
      // Teacher A cannot list assignments for a foreign school's class.
      const foreignSchool = asRows(await query(teacherCtxA, B.classId));
      expect(foreignSchool.length).toBe(0);
      // Same school, different teacher: teacher B cannot list teacherTwoB's
      // class assignments either.
      const foreignInSchool = asRows(await query(teacherCtxB, classTwoBId));
      expect(foreignInSchool.length).toBe(0);
      // SCHOOL_ADMIN may list any class in their own school.
      const viaAdmin = await query(ctxB, classTwoBId);
      expect(Array.isArray(viaAdmin)).toBe(true);
      break;
    }
    case "listAssignableContent": {
      // Platform-global content gated by which programs the CALLER's school
      // enabled — school A's tree must never include school B's program.
      const content = (await query(ctxA)) as { worlds: { id: string }[] };
      expect(Array.isArray(content.worlds)).toBe(true);
      expectNoForeignIds(content, name);
      break;
    }
    case "listClasses": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBe(1);
      for (const row of rows) expect(row["id"]).toBe(A.classId);
      expectNoForeignIds(rows, name);
      break;
    }
    case "getClassDetail": {
      expect(await query(ctxA, B.classId)).toBeNull();
      const own = (await query(ctxA, A.classId)) as { id: string } | null;
      expect(own?.id).toBe(A.classId);
      expectNoForeignIds(own, name);
      break;
    }
    case "listMyClasses": {
      const rows = asRows(await query(teacherCtxA));
      expect(rows.length).toBe(1);
      expect(rows[0]?.["id"]).toBe(A.classId);
      expectNoForeignIds(rows, name);
      break;
    }
    case "listSchoolAuditLogs": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) expect(row["schoolId"]).toBe(A.school.id);
      expectNoForeignIds(rows, name);
      break;
    }
    case "listAcademicYears": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) expect(row["schoolId"]).toBe(A.school.id);
      expectNoForeignIds(rows, name);
      break;
    }
    case "listImportHistory": {
      // No import has run in this fixture — the isolation property is that a
      // school-B import audit entry (if any existed) would never surface here.
      const rows = asRows(await query(ctxA));
      for (const row of rows) expect(row["schoolId"]).toBe(A.school.id);
      expectNoForeignIds(rows, name);
      break;
    }
    case "getSchoolProgressReport": {
      const rows = asRows(await query(ctxA));
      // >= not ===: sibling fixtures (e.g. the analytics suite's extra
      // teacher/class) may add more of school A's own students here — the
      // isolation property under test is "never school B", not an exact count.
      expect(rows.length).toBeGreaterThanOrEqual(A.studentIds.length);
      const rowStudentIds = rows.map((r) => r["studentId"]);
      for (const id of A.studentIds) expect(rowStudentIds).toContain(id);
      for (const row of rows) {
        expect(B.studentIds).not.toContain(row["studentId"]);
      }
      expectNoForeignIds(rows, name);
      break;
    }
    case "getSchoolDataExport": {
      const bundle = (await query(ctxA)) as {
        school: { id: string };
        teachers: { id: string }[];
        students: { id: string }[];
        classes: { id: string }[];
        certificates: { serial: string }[];
      };
      expect(bundle.school.id).toBe(A.school.id);
      // >= not ===, same reasoning as getSchoolProgressReport above: sibling
      // fixtures in this file add more of school A's own rows over time.
      expect(bundle.teachers.map((t) => t.id)).toContain(A.teacherId);
      const exportedStudentIds = bundle.students.map((s) => s.id);
      for (const id of A.studentIds) expect(exportedStudentIds).toContain(id);
      expect(bundle.classes.map((c) => c.id)).toContain(A.classId);
      expect(bundle.certificates.map((c) => c.serial)).toContain("BB-2026-AAAAAA");
      expect(bundle.certificates.map((c) => c.serial)).not.toContain("BB-2026-BBBBBB");
      expectNoForeignIds(bundle, name);
      break;
    }
    case "getMyStudentSnapshot": {
      const own = await query(studentCtxA);
      expect(own).not.toBeNull();
      expectNoForeignIds(own, name);
      // A ctx claiming school A but carrying school B's user must get nothing.
      const mismatched = createCtx({
        userId: B.studentIds[0],
        role: "STUDENT",
        schoolId: A.school.id,
      });
      expect(await query(mismatched)).toBeNull();
      break;
    }
    case "getMyAchievements": {
      const rowsA = asRows(await query(studentCtxA));
      const earnedA = rowsA.find((r) => r["slug"] === "isolation-test-badge");
      expect(earnedA?.["earnedAt"]).not.toBeNull();
      // Definitions are platform-global (visible to both schools' students),
      // but the EARNED state must never cross the school boundary.
      const rowsB = asRows(await query(studentCtxB));
      const earnedB = rowsB.find((r) => r["slug"] === "isolation-test-badge");
      expect(earnedB?.["earnedAt"]).toBeNull();
      expectNoForeignIds(rowsA, name);
      break;
    }
    case "getMyClassLeaderboard": {
      // The board is class-scoped by design (children's data — see the
      // query's own note), so isolation has two halves: only classmates
      // appear, and a ctx carrying another school's user gets nothing.
      const rowsA = asRows(await query(studentCtxA));
      const idsA = rowsA.map((r) => r["userId"]);
      // Both of school A's students share A.classId, so both must appear…
      expect(idsA).toContain(A.studentIds[0]);
      expect(idsA).toContain(A.studentIds[1]);
      // …and neither of school B's may, even though they're also STUDENTs.
      expect(idsA).not.toContain(B.studentIds[0]);
      expect(idsA).not.toContain(B.studentIds[1]);
      // Exactly one row is flagged as the caller.
      expect(rowsA.filter((r) => r["isMe"] === true)).toHaveLength(1);
      expectNoForeignIds(rowsA, name);

      // A ctx claiming school A while carrying school B's user must resolve
      // to no membership at all — not to school A's board.
      const mismatched = createCtx({
        userId: B.studentIds[0],
        role: "STUDENT",
        schoolId: A.school.id,
      });
      expect(asRows(await query(mismatched))).toHaveLength(0);
      break;
    }
    case "getMyFeedback": {
      // Feedback is written to ONE child. School A's student sees only what
      // was written to them; a ctx carrying school B's user while claiming
      // school A must see nothing at all.
      const rowsA = asRows(await query(studentCtxA));
      expect(rowsA.every((r) => r["id"] === feedbackAId)).toBe(true);
      expectNoForeignIds(rowsA, name);
      const mismatched = createCtx({
        userId: B.studentIds[0],
        role: "STUDENT",
        schoolId: A.school.id,
      });
      expect(asRows(await query(mismatched))).toHaveLength(0);
      break;
    }
    case "getMyUnreadFeedbackCount": {
      // A count leaks less than rows, but it still must not count another
      // school's messages.
      expect(await query(studentCtxA)).toBe(1);
      const mismatched = createCtx({
        userId: B.studentIds[0],
        role: "STUDENT",
        schoolId: A.school.id,
      });
      expect(await query(mismatched)).toBe(0);
      break;
    }
    case "listSchoolCertificates": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBe(1);
      expect(rows[0]?.["id"]).toBe(certAId);
      expectNoForeignIds(rows, name);
      break;
    }
    case "listMyCertificates": {
      const rowsA = asRows(await query(studentCtxA));
      expect(rowsA.length).toBe(1);
      expect(rowsA[0]?.["id"]).toBe(certAId);
      expectNoForeignIds(rowsA, name);
      // The B-school student's own list holds only their own certificate.
      const rowsB = asRows(await query(studentCtxB));
      expect(rowsB.length).toBe(1);
      expect(rowsB[0]?.["id"]).toBe(certBId);
      expect(JSON.stringify(rowsB)).not.toContain(certAId);
      break;
    }
    case "computeAdventureState": {
      const state = (await query(studentCtxA)) as AdventureState;
      expect(state.program?.id).toBe(programAId);
      const world = state.worlds[0];
      expect(world).toBeDefined();
      const levels = world!.modules[0]!.levels;
      const one = levels.find((l) => l.id === levelOneId);
      const two = levels.find((l) => l.id === levelTwoId);
      // Student A's own unlock state: level 1 opened by recomputeUnlocks,
      // level 2 still locked...
      expect(one?.state).toBe("UNLOCKED");
      expect(two?.state).toBe("LOCKED");
      expect(state.currentLevelId).toBe(levelOneId);
      // ...and NONE of school-B student's full-star COMPLETED rows on these
      // same global levels bleed into A's view.
      expect(one?.stars).toBe(0);
      expect(two?.stars).toBe(0);
      expect(world!.starsEarned).toBe(0);
      expect(world!.completedLevels).toBe(0);
      expectNoForeignIds(state, name);
      break;
    }
    case "getLevelIntro": {
      const intro = (await query(studentCtxA, levelOneId)) as Record<
        string,
        unknown
      > | null;
      expect(intro).not.toBeNull();
      // Progress comes only from the calling student's rows — school B's
      // 3-star completion of the same global level must not appear.
      expect(intro?.["state"]).toBe("UNLOCKED");
      expect(intro?.["stars"]).toBe(0);
      // Answer-bearing content never reaches the student surface.
      expect(intro && "payload" in intro).toBe(false);
      expect(intro && "hints" in intro).toBe(false);
      expect(JSON.stringify(intro)).not.toContain("SECRET");
      expectNoForeignIds(intro, name);
      // A school-B student is on a different program: the level is foreign
      // content for them and resolves to nothing (not an error).
      expect(await query(studentCtxB, levelOneId)).toBeNull();
      break;
    }
    case "getPlayableLevel": {
      const playable = (await query(studentCtxA, levelOneId)) as Record<
        string,
        unknown
      > | null;
      expect(playable).not.toBeNull();
      // Progress facts come only from the calling student's own rows.
      expect(playable?.["state"]).toBe("UNLOCKED");
      expect(playable?.["starsBest"]).toBe(0);
      expect(playable?.["hintsUsedTiers"]).toEqual([]);
      // Answer-bearing payload fields are stripped and server-held hints
      // never ship in the playable payload.
      const payload = playable?.["payload"] as Record<string, unknown>;
      expect(payload["solution"]).toBeUndefined();
      expect(playable && "hints" in playable).toBe(false);
      expect(JSON.stringify(playable)).not.toContain("SECRET");
      expectNoForeignIds(playable, name);
      // Locked level (no progress row) → null, and a school-B student on a
      // different program gets null for this level, not an error.
      expect(await query(studentCtxA, levelTwoId)).toBeNull();
      expect(await query(studentCtxB, levelOneId)).toBeNull();
      break;
    }
    // ── Curriculum content queries: platform-GLOBAL, not tenant-scoped.
    // The isolation property is access control: browse queries must reject
    // any school-scoped session outright (requirePlatform), and the
    // published readers must never surface answer-bearing content.
    case "listCurriculumPrograms":
    case "listCurriculumWorlds": {
      await expect(query(ctxA)).rejects.toThrow();
      await expect(query(teacherCtxA)).rejects.toThrow();
      await expect(query(studentCtxA)).rejects.toThrow();
      const rows = await query(nitaqCtx);
      expect(Array.isArray(rows)).toBe(true);
      break;
    }
    case "getCurriculumLevelDetail": {
      await expect(query(ctxA, levelOneId)).rejects.toThrow();
      await expect(query(studentCtxA, levelOneId)).rejects.toThrow();
      expect(await query(nitaqCtx, "no-such-level")).toBeNull();
      break;
    }
    case "getPublishedLevelSnapshot": {
      // Plain published-content reader (no session): unknown level → null,
      // published level → snapshot (server-internal, may carry answers).
      const read = query as unknown as (id: string) => Promise<unknown>;
      expect(await read("no-such-level")).toBeNull();
      const published = await read(levelOneId);
      expect(published).not.toBeNull();
      break;
    }
    case "stripStudentPayload": {
      // Pure helper: every answer-bearing key is removed before a payload
      // may reach a student client.
      const strip = query as unknown as (t: string, p: unknown) => unknown;
      const stripped = strip("SEQUENCING", {
        prompt: { en: "Sort" },
        items: [],
        correctOrder: ["a"],
        correctOptionId: "a",
        solution: "SECRET",
      }) as Record<string, unknown>;
      expect(stripped["correctOrder"]).toBeUndefined();
      expect(stripped["correctOptionId"]).toBeUndefined();
      expect(stripped["solution"]).toBeUndefined();
      expect(stripped["prompt"]).toEqual({ en: "Sort" });
      break;
    }
    default: {
      // Unknown registry key: still deep-scan for leakage, then fail so the
      // author of the new query must add explicit assertions above.
      const result = await query(ctxA);
      expectNoForeignIds(result, name);
      expect.fail(
        `Tenant query "${name}" (${entry.modulePath}) has no explicit isolation assertions — ` +
          `add a case for it in tenant-isolation.test.ts`,
      );
    }
  }
}

describe("tenant isolation — registered queries", () => {
  it("discovers at least one tenantScopedQueries registry", () => {
    expect(registryEntries.length).toBeGreaterThan(0);
  });

  for (const entry of registryEntries) {
    it(`${entry.name} [${entry.modulePath}] never exposes school B data to school A`, async () => {
      await assertQueryIsolated(entry);
    });
  }
});

describe("tenant isolation — registry completeness", () => {
  for (const [modulePath, mod] of Object.entries(queryModules)) {
    it(`${modulePath} registers every exported query`, () => {
      const registry = mod["tenantScopedQueries"];
      if (!registry || typeof registry !== "object") {
        expect.fail(
          `${modulePath} must export a tenantScopedQueries registry (hard rule 1)`,
        );
      }
      const registered = registry as Record<string, unknown>;
      for (const [exportName, value] of Object.entries(mod)) {
        if (typeof value !== "function") continue;
        if (exportName.startsWith("_")) continue; // helper convention
        expect(
          registered[exportName],
          `exported query "${exportName}" in ${modulePath} is missing from its tenantScopedQueries registry`,
        ).toBe(value);
      }
    });
  }
});

describe("platform queries", () => {
  it("platform admin sees both schools (cross-tenant scope is intentional)", async () => {
    const overview = await getPlatformOverview(nitaqCtx);
    expect(overview.schools).toBeGreaterThanOrEqual(2);
    const schools = await listSchools(nitaqCtx);
    const ids = schools.map((s) => s.id);
    expect(ids).toContain(A.school.id);
    expect(ids).toContain(B.school.id);
  });

  it("school admin is rejected by the platform guard", async () => {
    await expect(getPlatformOverview(ctxA)).rejects.toThrow();
    await expect(listSchools(ctxA)).rejects.toThrow();
  });
});
