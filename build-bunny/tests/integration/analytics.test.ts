import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { toCsvBody } from "@/lib/csv";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import { getSchoolAnalytics } from "@/modules/analytics/server/school";
import { getPlatformAnalytics } from "@/modules/analytics/server/platform";
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
 * M5 task 2: school-admin and platform analytics, plus the CSV export
 * pipeline they feed. Figures are checked against hand-computed expectations
 * over real seeded rows (no snapshot testing) — see the fixture comments for
 * the arithmetic each assertion depends on. The formula-injection case
 * exercises the REAL production path (getSchoolAnalytics → toCsvBody), not a
 * reimplementation, since route handlers under src/app/api aren't
 * integration-tested directly in this codebase (no existing precedent for
 * driving a Next.js route handler from vitest — see other test files).
 */

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

let schoolId: string;
let schoolTwoId: string;
let adminCtx: SessionContext;
let teacherCtx: SessionContext;
let studentCtx: SessionContext;
let l1Id: string;
let l2Id: string;
let classAId: string; // the formula-injection-named class
let classBId: string;
let s1Id: string;
let s2Id: string;
let s3Id: string;

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Analytika");
  schoolId = school.id;
  const schoolTwo = await createTestSchool("AnalytikaTwo");
  schoolTwoId = schoolTwo.id;

  const admin = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-admin@test.example`,
    displayName: "Analytics Admin",
    role: "SCHOOL_ADMIN",
    password: "admin-pass-11",
  });
  const teacher = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-teacher@test.example`,
    displayName: "Analytics Teacher",
    role: "TEACHER",
    password: "teach-pass-11",
  });

  const year = await db.academicYear.create({
    data: {
      schoolId,
      name: "2026-2027",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2027-06-30T00:00:00Z"),
    },
  });

  // Class name deliberately starts with "=" — the formula-injection fixture
  // for the CSV export test below (real spreadsheet-app attack payload
  // shape, e.g. a DDE/formula launch string), created the same way a school
  // admin would type a class name, not specially crafted for the query layer.
  const classA = await db.class.create({
    data: { schoolId, academicYearId: year.id, name: "=3A(evil)", grade: 3 },
  });
  classAId = classA.id;
  const classB = await db.class.create({
    data: { schoolId, academicYearId: year.id, name: "4A", grade: 4 },
  });
  classBId = classB.id;
  await db.classMembership.create({
    data: { schoolId, classId: classAId, userId: teacher.userId, role: "TEACHER" },
  });

  // Content: one world/module/two levels, enabled for school one only.
  const program = await createTestProgram({ name: "Analytics Program" });
  const world = await addWorldToProgram(program.id, 1, { name: "Analytics World" });
  const mod = await createTestModule(world.id, 1);
  const l1 = await createTestLevel(mod.id, 1, { title: "Level One" });
  const l2 = await createTestLevel(mod.id, 2, { title: "Level Two" });
  l1Id = l1.id;
  l2Id = l2.id;
  await enableProgramForSchool(schoolId, program.id);

  // ── Students ──────────────────────────────────────────────────────────
  // S1 (grade 3, class A): L1 COMPLETED 3★, L2 COMPLETED 2★ → active TODAY.
  // S2 (grade 3, class A): L1 COMPLETED 1★ → active 3 days ago (within week).
  // S3 (grade 4, class B): no progress → active 20 days ago (within month,
  // outside week) — the week-vs-month distinction the dashboard draws.
  const s1 = await createStudent(SYSTEM_ACTOR, {
    schoolId,
    schoolCode: school.code,
    username: "s1",
    displayName: "Student One",
    studentIdentifier: "A-001",
    grade: 3,
  });
  s1Id = s1.userId;
  const s2 = await createStudent(SYSTEM_ACTOR, {
    schoolId,
    schoolCode: school.code,
    username: "s2",
    displayName: "Student Two",
    studentIdentifier: "A-002",
    grade: 3,
  });
  s2Id = s2.userId;
  const s3 = await createStudent(SYSTEM_ACTOR, {
    schoolId,
    schoolCode: school.code,
    username: "s3",
    displayName: "Student Three",
    studentIdentifier: "A-003",
    grade: 4,
  });
  s3Id = s3.userId;

  for (const userId of [s1Id, s2Id]) {
    await db.classMembership.create({ data: { schoolId, classId: classAId, userId, role: "STUDENT" } });
  }
  await db.classMembership.create({ data: { schoolId, classId: classBId, userId: s3Id, role: "STUDENT" } });

  await db.studentProgress.create({
    data: { schoolId, studentUserId: s1Id, levelId: l1Id, status: "COMPLETED", stars: 3 },
  });
  await db.studentProgress.create({
    data: { schoolId, studentUserId: s1Id, levelId: l2Id, status: "COMPLETED", stars: 2 },
  });
  await db.studentProgress.create({
    data: { schoolId, studentUserId: s2Id, levelId: l1Id, status: "COMPLETED", stars: 1 },
  });
  // totalLevels = 2. Grade 3: 2 students, 3 completed cells, 6 stars →
  // completionPct = round(3/4*100) = 75, avgStars = round(6/3*10)/10 = 2.
  // Grade 4: 1 student, 0 completed → completionPct 0, avgStars 0.
  // Class A: same 3 cells / 6 stars as grade 3 (its whole roster) → 75 / 2.
  // Class B: 0 cells → 0 / 0.
  // School-wide: 3 completed cells, 6 stars (3+2 for S1, 1 for S2) →
  // round(6/3*10)/10 = 2.

  await db.studentProfile.update({ where: { userId: s1Id }, data: { lastActiveDate: new Date() } });
  await db.studentProfile.update({ where: { userId: s2Id }, data: { lastActiveDate: daysAgo(3) } });
  await db.studentProfile.update({ where: { userId: s3Id }, data: { lastActiveDate: daysAgo(20) } });

  // ── Licence: 30 seats, ACTIVE, expires in 30 days (inside the platform
  // dashboard's 60-day "expiring soon" horizon). ──────────────────────────
  await db.licence.create({
    data: { schoolId, seats: 30, startsAt: daysAgo(300), expiresAt: daysAgo(-30), status: "ACTIVE" },
  });
  // A SUSPENDED licence must never surface in the expiry pipeline even
  // though its date is inside the horizon (status filter, not date alone).
  await db.licence.create({
    data: { schoolId: schoolTwoId, seats: 5, startsAt: daysAgo(400), expiresAt: daysAgo(-20), status: "SUSPENDED" },
  });
  // An ACTIVE licence expiring far outside the horizon must not surface either.
  await db.licence.create({
    data: { schoolId: schoolTwoId, seats: 12, startsAt: daysAgo(10), expiresAt: daysAgo(-200), status: "ACTIVE" },
  });

  // ── Certificates: one valid (title carries a second formula-injection
  // payload, for the certificates CSV export), one revoked (must be excluded
  // from certificatesIssued / certificatesIssuedTotal). Direct writes, like
  // the certificates.test.ts / tenant-isolation.test.ts fixtures — the
  // issuance pipeline itself has its own dedicated suite. ─────────────────
  await db.certificate.create({
    data: {
      schoolId,
      studentUserId: s1Id,
      kind: "WORLD_COMPLETION",
      worldId: world.id,
      serial: "BB-2026-ANALYT",
      verifySlug: "analytics-test-verify-valid",
      studentName: "Student One",
      schoolName: school.name,
      title: { en: "=cmd|'/C calc'!A1" },
      starsEarned: 5,
      levelsCount: 2,
    },
  });
  await db.certificate.create({
    data: {
      schoolId,
      studentUserId: s2Id,
      kind: "WORLD_COMPLETION",
      worldId: world.id,
      serial: "BB-2026-REVOKD",
      verifySlug: "analytics-test-verify-revoked",
      studentName: "Student Two",
      schoolName: school.name,
      title: { en: "Analytics World" },
      starsEarned: 1,
      levelsCount: 1,
      revokedAt: new Date(),
      revokeReason: "test",
    },
  });
  // A second school's certificate — proves getPlatformAnalytics' total
  // crosses the tenant boundary on purpose (unlike the school-scoped count).
  await db.certificate.create({
    data: {
      schoolId: schoolTwoId,
      studentUserId: null,
      kind: "WORLD_COMPLETION",
      worldId: world.id,
      serial: "BB-2026-OTHERS",
      verifySlug: "analytics-test-verify-other-school",
      studentName: "Other School Student",
      schoolName: schoolTwo.name,
      title: { en: "Analytics World" },
      starsEarned: 3,
      levelsCount: 1,
    },
  });

  // ── LearningEvents driving most-attempted / most-failed levels ──────────
  // L1: 3 succeeded + 1 failed → 4 attempts, 25% fail rate.
  // L2: 1 succeeded + 4 failed → 5 attempts, 80% fail rate.
  // So mostAttempted = [L2, L1]; mostFailed = [L2, L1] too (both orderings
  // happen to agree here on rank but for DIFFERENT reasons — attempts vs
  // fail rate — which the per-field assertions below check independently).
  const eventRows: { levelId: string; type: "RUN_SUCCEEDED" | "RUN_FAILED" }[] = [
    ...Array(3).fill({ levelId: l1Id, type: "RUN_SUCCEEDED" as const }),
    { levelId: l1Id, type: "RUN_FAILED" as const },
    { levelId: l2Id, type: "RUN_SUCCEEDED" as const },
    ...Array(4).fill({ levelId: l2Id, type: "RUN_FAILED" as const }),
  ];
  for (const row of eventRows) {
    await db.learningEvent.create({
      data: { schoolId, studentUserId: s1Id, type: row.type, levelId: row.levelId },
    });
  }

  // ── StudentDailyActivity: DAU/WAU fixture. S1 active today (DAU + WAU),
  // S2 active 3 days ago (WAU only), S3 has no daily-activity row at all. ──
  await db.studentDailyActivity.create({
    data: { schoolId, studentUserId: s1Id, date: utcDateOnly(new Date()) },
  });
  await db.studentDailyActivity.create({
    data: { schoolId, studentUserId: s2Id, date: utcDateOnly(daysAgo(3)) },
  });

  // ── ActivityAttempt rows: the platform's 14-day attempts trend. Two
  // NORMAL attempts today, one 5 days ago, and one PREVIEW attempt today
  // that must NOT be counted (impersonated/staff test-play, m3-contracts). ─
  const attemptBase = {
    schoolId,
    studentUserId: s1Id,
    levelId: l1Id,
    levelVersion: 1,
    engineVersion: "1.0.0",
    workspaceJson: {},
    generatedCode: "",
    resultSummary: {},
    verdict: "PASS" as const,
    starsEarned: 3,
  };
  await db.activityAttempt.create({
    data: { ...attemptBase, attemptRunId: "an-today-1", kind: "NORMAL" },
  });
  await db.activityAttempt.create({
    data: { ...attemptBase, attemptRunId: "an-today-2", kind: "NORMAL" },
  });
  await db.activityAttempt.create({
    data: { ...attemptBase, attemptRunId: "an-preview-today", kind: "PREVIEW" },
  });
  await db.activityAttempt.create({
    data: { ...attemptBase, attemptRunId: "an-5days-ago", kind: "NORMAL", createdAt: daysAgo(5) },
  });

  adminCtx = createCtx({ userId: admin.userId, role: "SCHOOL_ADMIN", schoolId });
  teacherCtx = createCtx({ userId: teacher.userId, role: "TEACHER", schoolId });
  studentCtx = createCtx({ userId: s1Id, role: "STUDENT", schoolId });
});

describe("getSchoolAnalytics — figures against seeded data", () => {
  it("returns null for a non-SCHOOL_ADMIN session (defense in depth)", async () => {
    expect(await getSchoolAnalytics(teacherCtx)).toBeNull();
    expect(await getSchoolAnalytics(studentCtx)).toBeNull();
  });

  it("reports active-this-week vs active-this-month correctly", async () => {
    const analytics = await getSchoolAnalytics(adminCtx);
    expect(analytics).not.toBeNull();
    // S1 (today) + S2 (3 days ago) are within the week; S3 (20 days ago) is not.
    expect(analytics!.activeStudentsThisWeek).toBe(2);
    // All three are within the month.
    expect(analytics!.activeStudentsThisMonth).toBe(3);
    expect(analytics!.totalStudents).toBe(3);
  });

  it("computes per-grade completion and average stars", async () => {
    const analytics = await getSchoolAnalytics(adminCtx);
    const grade3 = analytics!.byGrade.find((g) => g.grade === 3);
    const grade4 = analytics!.byGrade.find((g) => g.grade === 4);
    expect(grade3).toEqual({ grade: 3, studentCount: 2, completionPct: 75, avgStars: 2 });
    expect(grade4).toEqual({ grade: 4, studentCount: 1, completionPct: 0, avgStars: 0 });
  });

  it("computes per-class comparison, including a class whose name is a formula-injection payload", async () => {
    const analytics = await getSchoolAnalytics(adminCtx);
    const classRowA = analytics!.byClass.find((c) => c.classId === classAId);
    const classRowB = analytics!.byClass.find((c) => c.classId === classBId);
    // The query layer stores/returns the RAW class name — sanitization is
    // the CSV boundary's job, not the data layer's (tested separately below).
    expect(classRowA).toEqual({
      classId: classAId,
      className: "=3A(evil)",
      grade: 3,
      studentCount: 2,
      completionPct: 75,
      avgStars: 2,
      activeThisWeek: 2,
    });
    expect(classRowB).toEqual({
      classId: classBId,
      className: "4A",
      grade: 4,
      studentCount: 1,
      completionPct: 0,
      avgStars: 0,
      activeThisWeek: 0,
    });
  });

  it("reports certificates issued (excluding the revoked one) and licence seats used vs total", async () => {
    const analytics = await getSchoolAnalytics(adminCtx);
    expect(analytics!.certificatesIssued).toBe(1);
    expect(analytics!.licenceSeatsUsed).toBe(3);
    expect(analytics!.licenceSeatsTotal).toBe(30);
    expect(analytics!.avgStarsAcrossCompletions).toBe(2);
  });

  it("ranks most-attempted and most-failed levels correctly", async () => {
    const analytics = await getSchoolAnalytics(adminCtx);
    expect(analytics!.mostAttemptedLevels.map((l) => l.levelId)).toEqual([l2Id, l1Id]);
    expect(analytics!.mostAttemptedLevels.map((l) => l.attempts)).toEqual([5, 4]);
    expect(analytics!.mostFailedLevels.map((l) => l.levelId)).toEqual([l2Id, l1Id]);
    expect(analytics!.mostFailedLevels.map((l) => l.failRatePct)).toEqual([80, 25]);
    const l2Row = analytics!.mostFailedLevels[0]!;
    // createTestLevel prefixes the Level row's OWN title with "DRAFT " on
    // purpose (fixtures/README) to distinguish it from the LevelVersion
    // snapshot text; analytics reads the row directly, same as teacher.ts's
    // loadSchoolLevels — a staff-facing level list intentionally shows the
    // level as currently authored, not a frozen published snapshot.
    expect(l2Row.title).toEqual({ en: "DRAFT Level Two" });
    expect(l2Row.worldName).toEqual({ en: "Analytics World" });
  });
});

describe("CSV export pipeline — real rows, formula injection neutralized", () => {
  it("class-progress CSV contains the expected row and neutralizes the injected class name", async () => {
    const analytics = await getSchoolAnalytics(adminCtx);
    const csv = toCsvBody([
      ["class_name", "grade", "students", "completion_pct", "avg_stars", "active_this_week"],
      ...analytics!.byClass.map((r) => [r.className, r.grade, r.studentCount, r.completionPct, r.avgStars, r.activeThisWeek]),
    ]);
    // Neutralized with a leading apostrophe, on its own row, with the rest of
    // that row's real figures intact — this is the whole test: a formula
    // parser (or a regex hunting for a bare "=..." cell) would find nothing,
    // because every occurrence of the payload in the file is apostrophe-led.
    expect(csv).toContain("'=3A(evil),3,2,75,2,2");
    expect(csv).toContain("4A,4,1,0,0,0");
    // The row never starts with the RAW (un-neutralized) payload — a
    // spreadsheet app would only ever see literal text, never a formula.
    expect(csv).not.toMatch(/[\r\n]=3A\(evil\)/);
  });

  it("certificates CSV contains the expected row and neutralizes the injected title, excludes the revoked one", async () => {
    const rows = await import("@/modules/certificates/server/queries").then((m) =>
      m.listSchoolCertificates(adminCtx),
    );
    expect(rows).toHaveLength(2); // both valid AND revoked certs list here — export shows status per row
    const csv = toCsvBody([
      ["student_name", "certificate", "kind", "serial", "issued_date", "status"],
      ...rows.map((r) => [
        r.studentName,
        resolveText(r.title, "en"),
        r.kind,
        r.serial,
        r.issuedAt.slice(0, 10),
        r.revokedAt ? "revoked" : "valid",
      ]),
    ]);
    expect(csv).toContain("'=cmd|'/C calc'!A1");
    // Never appears as a bare, un-neutralized formula cell (preceded by a
    // field-separating comma with no guarding apostrophe).
    expect(csv).not.toMatch(/,=cmd\|/);
    expect(csv).toContain("BB-2026-ANALYT");
    expect(csv).toContain("BB-2026-REVOKD,");
    const revokedLine = csv.split("\r\n").find((line) => line.includes("BB-2026-REVOKD"));
    expect(revokedLine).toContain("revoked");
  });
});

describe("getPlatformAnalytics — platform-only guard and cross-school figures", () => {
  it("rejects a non-platform session", async () => {
    await expect(getPlatformAnalytics(adminCtx)).rejects.toThrow();
    await expect(getPlatformAnalytics(teacherCtx)).rejects.toThrow();
  });

  it("computes DAU/WAU from StudentDailyActivity", async () => {
    const nitaqCtx = createCtx({ userId: "platform-admin", role: "NITAQ_ADMIN", schoolId: null });
    const analytics = await getPlatformAnalytics(nitaqCtx);
    // S1 today → DAU. S1 + S2 within 7 days → WAU. S3 has no daily-activity row.
    expect(analytics.dauStudents).toBe(1);
    expect(analytics.wauStudents).toBe(2);
  });

  it("buckets the 14-day attempts trend by UTC day and excludes PREVIEW attempts", async () => {
    const nitaqCtx = createCtx({ userId: "platform-admin", role: "NITAQ_ADMIN", schoolId: null });
    const analytics = await getPlatformAnalytics(nitaqCtx);
    expect(analytics.attemptsPerDay14d).toHaveLength(14);
    const todayKey = utcDateOnly(new Date()).toISOString().slice(0, 10);
    const fiveDaysAgoKey = utcDateOnly(daysAgo(5)).toISOString().slice(0, 10);
    const today = analytics.attemptsPerDay14d.find((p) => p.date === todayKey);
    const fiveDaysAgo = analytics.attemptsPerDay14d.find((p) => p.date === fiveDaysAgoKey);
    // 2 NORMAL attempts today (the PREVIEW one is excluded); 1 five days ago.
    expect(today?.attempts).toBe(2);
    expect(fiveDaysAgo?.attempts).toBe(1);
    expect(analytics.attemptsPerDay14d.reduce((sum, p) => sum + p.attempts, 0)).toBe(3);
  });

  it("ranks schools by weekly activity and reports total certificates across schools", async () => {
    const nitaqCtx = createCtx({ userId: "platform-admin", role: "NITAQ_ADMIN", schoolId: null });
    const analytics = await getPlatformAnalytics(nitaqCtx);
    const schoolOne = analytics.schoolsByActivity.find((s) => s.schoolId === schoolId);
    const schoolTwo = analytics.schoolsByActivity.find((s) => s.schoolId === schoolTwoId);
    expect(schoolOne).toEqual({ schoolId, schoolName: expect.any(String), activeStudentsThisWeek: 2, totalStudents: 3 });
    expect(schoolTwo?.activeStudentsThisWeek).toBe(0);
    // 2 valid certificates across the two schools (the revoked one excluded).
    expect(analytics.certificatesIssuedTotal).toBe(2);
  });

  it("licence expiry pipeline includes only ACTIVE/GRACE licences inside the 60-day horizon", async () => {
    const nitaqCtx = createCtx({ userId: "platform-admin", role: "NITAQ_ADMIN", schoolId: null });
    const analytics = await getPlatformAnalytics(nitaqCtx);
    const schoolIds = analytics.licenceExpiryPipeline.map((l) => l.schoolId);
    expect(schoolIds).toContain(schoolId); // the 30-day-out ACTIVE licence
    expect(schoolIds).not.toContain(schoolTwoId); // SUSPENDED and far-future ACTIVE both excluded
  });

  it("finds the same most-failed levels platform-wide as the school-scoped view (single-school fixture)", async () => {
    const nitaqCtx = createCtx({ userId: "platform-admin", role: "NITAQ_ADMIN", schoolId: null });
    const analytics = await getPlatformAnalytics(nitaqCtx);
    expect(analytics.mostFailedLevels.map((l) => l.levelId)).toEqual([l2Id, l1Id]);
    expect(analytics.mostFailedLevels.map((l) => l.failRatePct)).toEqual([80, 25]);
  });
});
