import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { AUDIT } from "@/lib/audit";
import { NotFoundError } from "@/modules/auth/server/guard";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import { eraseStudent } from "@/modules/schools/server/management";
import { getSchoolDataExport } from "@/modules/schools/server/queries";
import { issueWorldCertificate } from "@/modules/certificates/server/issue";
import { verifyCertificate } from "@/modules/certificates/server/verify";
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
 * m5 §35: school-admin student erasure (hard delete + cascades) and the
 * school data export bundle. Erasure must leave a genuinely PASSed
 * certificate intact with its FROZEN display fields (schema §"Certificate":
 * studentUserId is the one deliberate SetNull FK) so /verify/[slug] keeps
 * resolving publicly after the account is gone — that is the whole point of
 * the frozen-fields design, so this suite proves it against the REAL
 * issuance path (issueWorldCertificate), not a direct db.certificate.create.
 */

let schoolAId: string;
let schoolACode: string;
let schoolBId: string;
let adminACtx: ReturnType<typeof createCtx>;
let adminBCtx: ReturnType<typeof createCtx>;
let worldId: string;
let levelAId: string;
let levelBId: string;
let studentUserId: string;
let studentUsername: string;
let classId: string;

async function completeLevel(userId: string, levelId: string, stars: number): Promise<void> {
  await db.studentProgress.upsert({
    where: { studentUserId_levelId: { studentUserId: userId, levelId } },
    create: {
      schoolId: schoolAId,
      studentUserId: userId,
      levelId,
      status: "COMPLETED",
      stars,
      attemptsCount: 1,
      unlockSource: "ORDER",
      firstCompletedAt: new Date(),
      lastActivityAt: new Date(),
      completedVersion: 1,
    },
    update: { status: "COMPLETED", stars },
  });
}

beforeAll(async () => {
  await wipeDatabase();

  const schoolA = await createTestSchool("privA");
  const schoolB = await createTestSchool("privB");
  schoolAId = schoolA.id;
  schoolACode = schoolA.code;
  schoolBId = schoolB.id;

  const adminA = await createStaff(SYSTEM_ACTOR, {
    schoolId: schoolA.id,
    email: `${schoolA.code}-admin@test.example`,
    displayName: "Privacy Admin A",
    role: "SCHOOL_ADMIN",
    password: "admin-pass-11",
  });
  const adminB = await createStaff(SYSTEM_ACTOR, {
    schoolId: schoolB.id,
    email: `${schoolB.code}-admin@test.example`,
    displayName: "Privacy Admin B",
    role: "SCHOOL_ADMIN",
    password: "admin-pass-11",
  });
  adminACtx = createCtx({ userId: adminA.userId, role: "SCHOOL_ADMIN", schoolId: schoolA.id });
  adminBCtx = createCtx({ userId: adminB.userId, role: "SCHOOL_ADMIN", schoolId: schoolB.id });

  const year = await db.academicYear.create({
    data: {
      schoolId: schoolA.id,
      name: "2026-2027",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2027-06-30T00:00:00Z"),
    },
  });
  const klass = await db.class.create({
    data: { schoolId: schoolA.id, academicYearId: year.id, name: "Privacy 3A", grade: 3 },
  });
  classId = klass.id;

  const program = await createTestProgram({ name: "Erasure Program" });
  const world = await addWorldToProgram(program.id, 1, { name: "Erasure World" });
  worldId = world.id;
  const mod = await createTestModule(world.id, 1);
  const levelA = await createTestLevel(mod.id, 1, { title: "Level A" });
  const levelB = await createTestLevel(mod.id, 2, { title: "Level B" });
  levelAId = levelA.id;
  levelBId = levelB.id;
  await enableProgramForSchool(schoolA.id, program.id);

  const student = await createStudent(SYSTEM_ACTOR, {
    schoolId: schoolA.id,
    schoolCode: schoolA.code,
    username: "erasable",
    displayName: "Erasable Student",
    studentIdentifier: "PRIV-001",
    grade: 4,
  });
  studentUserId = student.userId;
  studentUsername = student.username;
  await db.classMembership.create({
    data: { schoolId: schoolA.id, classId: klass.id, userId: studentUserId, role: "STUDENT" },
  });

  // Learning history across every table erasure must cascade-clean.
  await completeLevel(studentUserId, levelAId, 2);
  await completeLevel(studentUserId, levelBId, 3);
  await db.hintUsage.create({
    data: { schoolId: schoolA.id, studentUserId, levelId: levelAId, tier: 1 },
  });
  await db.xpEvent.create({
    data: { schoolId: schoolA.id, studentUserId, levelId: levelAId, source: "LEVEL_PASS", amount: 50 },
  });
  await db.studentDailyActivity.create({
    data: { schoolId: schoolA.id, studentUserId, date: new Date("2026-08-01"), runs: 3, completions: 2, xp: 50 },
  });
  const achievement = await db.achievement.create({
    data: {
      slug: "privacy-test-badge",
      name: { en: "Privacy Badge" },
      description: { en: "For privacy testing" },
      icon: "🔒",
      criteria: { type: "FIRST_PASS" },
      order: 1,
    },
  });
  await db.studentAchievement.create({
    data: { schoolId: schoolA.id, studentUserId, achievementId: achievement.id },
  });
  await db.activityAttempt.create({
    data: {
      attemptRunId: "privacy-test-attempt-1",
      schoolId: schoolA.id,
      studentUserId,
      levelId: levelAId,
      levelVersion: 1,
      engineVersion: "1.0.0",
      kind: "NORMAL",
      workspaceJson: {},
      generatedCode: "",
      resultSummary: {},
      verdict: "PASS",
      starsEarned: 2,
    },
  });

  // A real sign-in-created session — erasure must remove it too.
  await db.session.create({
    data: {
      token: "privacy-test-session-token",
      userId: studentUserId,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  // Genuine full-PASS world completion through the real issuance path.
  const issued = await issueWorldCertificate({ schoolId: schoolA.id, studentUserId, worldId });
  expect(issued.certificate).not.toBeNull();
});

describe("eraseStudent", () => {
  it("school B's admin cannot erase school A's student (NOT_FOUND, nothing deleted)", async () => {
    await expect(eraseStudent(adminBCtx, studentUserId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await db.user.findUnique({ where: { id: studentUserId } })).not.toBeNull();
  });

  it("hard-deletes the student and cascades every learning row", async () => {
    const cert = await db.certificate.findFirstOrThrow({ where: { studentUserId, worldId } });

    const result = await eraseStudent(adminACtx, studentUserId);
    expect(result).toEqual({ displayName: "Erasable Student", studentIdentifier: "PRIV-001" });

    expect(await db.user.findUnique({ where: { id: studentUserId } })).toBeNull();
    expect(await db.studentProfile.findUnique({ where: { userId: studentUserId } })).toBeNull();
    expect(await db.classMembership.count({ where: { userId: studentUserId } })).toBe(0);
    expect(await db.studentProgress.count({ where: { studentUserId } })).toBe(0);
    expect(await db.activityAttempt.count({ where: { studentUserId } })).toBe(0);
    expect(await db.xpEvent.count({ where: { studentUserId } })).toBe(0);
    expect(await db.hintUsage.count({ where: { studentUserId } })).toBe(0);
    expect(await db.studentDailyActivity.count({ where: { studentUserId } })).toBe(0);
    expect(await db.studentAchievement.count({ where: { studentUserId } })).toBe(0);
    expect(await db.session.count({ where: { userId: studentUserId } })).toBe(0);

    // The audit trail survives (AuditLog has no FK to User by design) and
    // captured a snapshot of who was erased before the row was gone.
    const auditRow = await db.auditLog.findFirst({
      where: { action: AUDIT.students.erased, targetId: studentUserId },
      orderBy: { createdAt: "desc" },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorUserId).toBe(adminACtx.userId);
    expect((auditRow?.meta as Record<string, unknown> | null)?.["studentIdentifier"]).toBe("PRIV-001");

    // The certificate survives with its FROZEN display fields untouched and
    // studentUserId SetNull (schema: "an erased student's certificate stays
    // verifiable") — public verification keeps working exactly as before.
    const survivingCert = await db.certificate.findUniqueOrThrow({ where: { id: cert.id } });
    expect(survivingCert.studentUserId).toBeNull();
    expect(survivingCert.studentName).toBe("Erasable Student");
    expect(survivingCert.schoolName).toBe(cert.schoolName);

    const publicView = await verifyCertificate(cert.verifySlug);
    expect(publicView).not.toBeNull();
    expect(publicView).toMatchObject({
      valid: true,
      revoked: false,
      studentName: "Erasable Student",
      serial: cert.serial,
      starsEarned: cert.starsEarned,
      levelsCount: cert.levelsCount,
    });
  });

  it("erasing an unknown/already-erased id is NOT_FOUND, not a crash", async () => {
    await expect(eraseStudent(adminACtx, studentUserId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("the erased username is free again (no unique-constraint ghost)", async () => {
    const reCreated = await createStudent(SYSTEM_ACTOR, {
      schoolId: schoolAId,
      schoolCode: schoolACode,
      username: "erasable",
      displayName: "Re-registered Student",
      studentIdentifier: "PRIV-002",
      grade: 4,
    });
    expect(reCreated.username).toBe(studentUsername);
  });
});

describe("getSchoolDataExport", () => {
  let exportedByAdminA: Awaited<ReturnType<typeof getSchoolDataExport>>;

  it("returns the calling school's own data only", async () => {
    exportedByAdminA = await getSchoolDataExport(adminACtx);
    expect(exportedByAdminA.school.id).toBe(schoolAId);
    expect(exportedByAdminA.classes.map((c) => c.id)).toContain(classId);
    // The erased student from the suite above must not linger in a fresh
    // export — the export reads live rows, not a cache.
    expect(exportedByAdminA.students.map((s) => s.id)).not.toContain(studentUserId);
  });

  it("never includes school B's rows, and vice versa", async () => {
    const exportedByAdminB = await getSchoolDataExport(adminBCtx);
    expect(exportedByAdminB.school.id).toBe(schoolBId);

    const jsonA = JSON.stringify(exportedByAdminA);
    expect(jsonA).not.toContain(schoolBId);
    const jsonB = JSON.stringify(exportedByAdminB);
    expect(jsonB).not.toContain(schoolAId);
    expect(jsonB.includes(classId)).toBe(false);
  });

  it("includes the surviving certificate but never the verify slug (public secret, not admin data)", async () => {
    const cert = await db.certificate.findFirstOrThrow({ where: { worldId, schoolId: schoolAId } });
    const fresh = await getSchoolDataExport(adminACtx);
    expect(fresh.certificates.map((c) => c.serial)).toContain(cert.serial);
    expect(JSON.stringify(fresh)).not.toContain(cert.verifySlug);
  });
});
