import "dotenv/config";

import Module from "node:module";
import path from "node:path";
import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import {
  CLASSES,
  DEMO_ACADEMIC_YEAR,
  DEMO_LICENCE,
  DEMO_SCHOOL,
  PLATFORM_STAFF,
  SCHOOL_ADMIN,
  SEED_ACTOR,
  STUDENTS,
  TEACHERS,
  studentDisplayName,
  type StudentSeed,
} from "./seed-data/demo-school";

/**
 * Demo-environment seed (plan §0.1-25): one excellent NITAQ Demo School.
 * Idempotent — every entity is keyed on its natural unique (school code,
 * emails, namespaced usernames, [schoolId, name] compounds) and skipped when
 * it already exists, so `npm run db:seed` is safe to re-run at any time.
 *
 * Accounts are provisioned through the SAME code paths the app uses
 * (createStaff/createStudent → Better Auth scrypt hashes + audit trail), so
 * seeded logins exercise the real sign-in stack, not a parallel one.
 */

// ── Runtime shims ─────────────────────────────────────────────────────────
// Two imports inside src/ server modules only exist in the Next.js runtime:
// the "server-only" marker (aliased by Next at build time, not installed as a
// package) and the request-scoped session module (next/headers, react cache,
// the Better Auth instance). The seed maps both to inert stand-ins BEFORE any
// src module loads — which is why every src import below is a dynamic
// `await import(...)` instead of a hoisted static one.
const moduleInternals = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const originalResolve = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") {
    return path.join(__dirname, "seed-data", "server-only-shim.cjs");
  }
  if (request === "@/modules/auth/server/session") {
    return path.join(__dirname, "seed-data", "session-shim.cjs");
  }
  return originalResolve.call(this, request, ...rest);
};

async function loadAppModules() {
  const { db } = await import("../src/lib/db");
  const { audit, AUDIT } = await import("../src/lib/audit");
  const { recordLearningEvent } = await import("../src/lib/events");
  const { createStaff, createStudent } = await import(
    "../src/modules/auth/server/provisioning"
  );
  return { db, audit, AUDIT, recordLearningEvent, createStaff, createStudent };
}

type App = Awaited<ReturnType<typeof loadAppModules>>;

// ── Logging ───────────────────────────────────────────────────────────────

const stats = { created: 0, skipped: 0 };

function logCreated(label: string): void {
  stats.created += 1;
  console.log(`  + created  ${label}`);
}

function logSkipped(label: string): void {
  stats.skipped += 1;
  console.log(`  = exists   ${label} (skipped)`);
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Crockford base32 (no I/L/O/U) — matches the schema's join-code contract. */
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

async function generateUniqueJoinCode(db: App["db"]): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += CROCKFORD_ALPHABET[randomInt(CROCKFORD_ALPHABET.length)];
    }
    const clash = await db.class.findUnique({ where: { joinCode: code } });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique join code after 20 attempts");
}

/**
 * The N most recent school days (Mon–Fri; UAE weekend is Sat–Sun), oldest
 * first, stamped with a deterministic class-time hour (08:00–12:00 Asia/Dubai
 * = 04:00–08:00 UTC) so demo trails look like real school logins.
 */
function recentSchoolDays(count: number, salt: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  while (days.length < count) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const day = new Date(cursor);
      day.setUTCHours(4 + ((salt + days.length) % 4), (salt * 17 + days.length * 23) % 60, 0, 0);
      days.push(day);
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return days.reverse();
}

function daysAgo(days: number): Date {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  d.setUTCHours(6, 0, 0, 0); // 10:00 Asia/Dubai
  return d;
}

// ── Entities ──────────────────────────────────────────────────────────────

async function ensureSchool(app: App): Promise<{ id: string }> {
  const existing = await app.db.school.findUnique({ where: { code: DEMO_SCHOOL.code } });
  if (existing) {
    logSkipped(`school ${DEMO_SCHOOL.code} (${existing.name})`);
    return existing;
  }
  const school = await app.db.school.create({
    data: {
      name: DEMO_SCHOOL.name,
      slug: DEMO_SCHOOL.slug,
      code: DEMO_SCHOOL.code,
      timezone: DEMO_SCHOOL.timezone,
      status: "ACTIVE",
    },
  });
  await app.audit({
    action: app.AUDIT.schools.created,
    actorUserId: SEED_ACTOR.userId,
    actorRole: SEED_ACTOR.role,
    schoolId: school.id,
    targetType: "school",
    targetId: school.id,
    meta: { seed: true, code: DEMO_SCHOOL.code },
  });
  logCreated(`school ${DEMO_SCHOOL.code} (${DEMO_SCHOOL.name})`);
  return school;
}

async function ensureLicence(app: App, schoolId: string): Promise<void> {
  const existing = await app.db.licence.findFirst({ where: { schoolId } });
  if (existing) {
    logSkipped(`licence (${existing.seats} seats, status ${existing.status})`);
    return;
  }
  await app.db.licence.create({
    data: {
      schoolId,
      seats: DEMO_LICENCE.seats,
      startsAt: DEMO_LICENCE.startsAt,
      expiresAt: DEMO_LICENCE.expiresAt,
      status: "ACTIVE",
    },
  });
  logCreated(`licence (${DEMO_LICENCE.seats} seats, ACTIVE)`);
}

async function ensureAcademicYear(app: App, schoolId: string): Promise<{ id: string }> {
  const existing = await app.db.academicYear.findUnique({
    where: { schoolId_name: { schoolId, name: DEMO_ACADEMIC_YEAR.name } },
  });
  if (existing) {
    logSkipped(`academic year ${DEMO_ACADEMIC_YEAR.name}`);
    return existing;
  }
  const year = await app.db.academicYear.create({
    data: {
      schoolId,
      name: DEMO_ACADEMIC_YEAR.name,
      startsAt: DEMO_ACADEMIC_YEAR.startsAt,
      endsAt: DEMO_ACADEMIC_YEAR.endsAt,
      isActive: DEMO_ACADEMIC_YEAR.isActive,
    },
  });
  logCreated(`academic year ${DEMO_ACADEMIC_YEAR.name}`);
  return year;
}

async function ensureStaff(
  app: App,
  input: {
    schoolId: string | null;
    email: string;
    displayName: string;
    role: "SUPER_ADMIN" | "NITAQ_ADMIN" | "SCHOOL_ADMIN" | "TEACHER";
    title?: string;
    password: string;
  },
): Promise<{ userId: string }> {
  const existing = await app.db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    logSkipped(`${input.role.toLowerCase()} ${input.email}`);
    return { userId: existing.id };
  }
  const created = await app.createStaff(SEED_ACTOR, {
    schoolId: input.schoolId,
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    title: input.title,
    password: input.password,
  });
  logCreated(`${input.role.toLowerCase()} ${input.email} (${input.displayName})`);
  return { userId: created.userId };
}

async function ensureClass(
  app: App,
  schoolId: string,
  academicYearId: string,
  name: string,
  grade: number,
): Promise<{ id: string; joinCode: string | null }> {
  const existing = await app.db.class.findUnique({
    where: { schoolId_academicYearId_name: { schoolId, academicYearId, name } },
  });
  if (existing) {
    logSkipped(`class ${name}`);
    return existing;
  }
  const joinCode = await generateUniqueJoinCode(app.db);
  const created = await app.db.class.create({
    data: { schoolId, academicYearId, name, grade, joinCode },
  });
  await app.audit({
    action: app.AUDIT.classes.created,
    actorUserId: SEED_ACTOR.userId,
    actorRole: SEED_ACTOR.role,
    schoolId,
    targetType: "class",
    targetId: created.id,
    meta: { seed: true, name, grade },
  });
  logCreated(`class ${name} (join code ${joinCode})`);
  return created;
}

async function ensureMembership(
  app: App,
  schoolId: string,
  classId: string,
  userId: string,
  role: "TEACHER" | "STUDENT",
  label: string,
): Promise<void> {
  const existing = await app.db.classMembership.findUnique({
    where: { classId_userId: { classId, userId } },
  });
  if (existing) {
    logSkipped(`membership ${label}`);
    return;
  }
  await app.db.classMembership.create({ data: { schoolId, classId, userId, role } });
  logCreated(`membership ${label}`);
}

async function ensureStudent(
  app: App,
  schoolId: string,
  student: StudentSeed,
): Promise<{ userId: string }> {
  const namespaced = `${DEMO_SCHOOL.code.toLowerCase()}__${student.username}`;
  const existing = await app.db.user.findUnique({ where: { username: namespaced } });
  if (existing) {
    logSkipped(`student ${student.username} (${studentDisplayName(student)})`);
    return { userId: existing.id };
  }
  const created = await app.createStudent(SEED_ACTOR, {
    schoolId,
    schoolCode: DEMO_SCHOOL.code,
    username: student.username,
    displayName: studentDisplayName(student),
    studentIdentifier: student.studentIdentifier,
    grade: student.grade,
    password: student.password,
  });
  logCreated(`student ${student.username} (${studentDisplayName(student)}, ${student.studentIdentifier})`);
  return { userId: created.userId };
}

/**
 * Demo progress states. Only bootstraps profiles that are still untouched
 * (all zeros, never active) so re-seeding never clobbers real demo usage —
 * this also heals a partially-completed earlier run.
 */
async function ensureStudentProgress(
  app: App,
  userId: string,
  student: StudentSeed,
  trail: Date[] | null,
): Promise<void> {
  const { progress } = student;
  const fresh =
    progress.xpTotal === 0 &&
    progress.starsTotal === 0 &&
    progress.streakBest === 0 &&
    progress.lastActiveDaysAgo === null;
  if (fresh) return; // defaults already say "never signed in"

  const profile = await app.db.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error(`missing StudentProfile for ${student.username}`);
  const untouched =
    profile.xpTotal === 0 &&
    profile.starsTotal === 0 &&
    profile.streakBest === 0 &&
    profile.lastActiveDate === null;
  if (!untouched) {
    logSkipped(`progress for ${student.username}`);
    return;
  }

  const lastTrailDay = trail?.[trail.length - 1];
  const lastActiveDate =
    lastTrailDay ??
    (progress.lastActiveDaysAgo !== null ? daysAgo(progress.lastActiveDaysAgo) : null);
  await app.db.studentProfile.update({
    where: { userId },
    data: {
      xpTotal: progress.xpTotal,
      starsTotal: progress.starsTotal,
      streakCurrent: progress.streakCurrent,
      streakBest: progress.streakBest,
      lastActiveDate,
      onboardedAt: lastActiveDate,
    },
  });
  logCreated(`progress for ${student.username} (${progress.xpTotal} XP, ${progress.starsTotal} stars)`);
}

/**
 * STUDENT_LOGIN trail on recent school days for the demo-active students —
 * login events only, honestly: no curriculum exists yet, so no fake level ids.
 * recordLearningEvent stamps createdAt=now; the rows are backdated after the
 * fact to spread across school days (safe: the existing-count guard means the
 * fetched rows are exactly the ones just written).
 */
async function ensureLoginTrail(
  app: App,
  schoolId: string,
  userId: string,
  student: StudentSeed,
  trail: Date[],
): Promise<void> {
  const existing = await app.db.learningEvent.count({
    where: { studentUserId: userId, type: "STUDENT_LOGIN" },
  });
  if (existing > 0) {
    logSkipped(`login trail for ${student.username} (${existing} events)`);
    return;
  }
  for (let i = 0; i < trail.length; i++) {
    await app.recordLearningEvent({
      type: "STUDENT_LOGIN",
      schoolId,
      studentUserId: userId,
    });
  }
  const events = await app.db.learningEvent.findMany({
    where: { studentUserId: userId, type: "STUDENT_LOGIN" },
    orderBy: { createdAt: "asc" },
    take: trail.length,
  });
  await Promise.all(
    events.map((event, i) =>
      app.db.learningEvent.update({
        where: { id: event.id },
        // trail has exactly events.length entries — guarded by the count above
        data: { createdAt: trail[i]! },
      }),
    ),
  );
  logCreated(`login trail for ${student.username} (${trail.length} school days)`);
}

// ── Verification ──────────────────────────────────────────────────────────

async function verifyCounts(app: App, schoolId: string): Promise<void> {
  const expectedEvents = STUDENTS.reduce((n, s) => n + (s.loginTrailDays ?? 0), 0);
  const checks: { label: string; expected: number; actual: number }[] = [
    {
      label: "platform staff",
      expected: PLATFORM_STAFF.length,
      actual: await app.db.user.count({
        where: { email: { in: PLATFORM_STAFF.map((s) => s.email) }, schoolId: null },
      }),
    },
    {
      label: "school admins",
      expected: 1,
      actual: await app.db.user.count({ where: { schoolId, role: "SCHOOL_ADMIN" } }),
    },
    {
      label: "teachers",
      expected: TEACHERS.length,
      actual: await app.db.user.count({ where: { schoolId, role: "TEACHER" } }),
    },
    {
      label: "students",
      expected: STUDENTS.length,
      actual: await app.db.user.count({ where: { schoolId, role: "STUDENT" } }),
    },
    {
      label: "student profiles",
      expected: STUDENTS.length,
      actual: await app.db.studentProfile.count({ where: { schoolId } }),
    },
    {
      label: "classes",
      expected: CLASSES.length,
      actual: await app.db.class.count({ where: { schoolId } }),
    },
    {
      label: "class memberships",
      expected: TEACHERS.length + STUDENTS.length,
      actual: await app.db.classMembership.count({ where: { schoolId } }),
    },
    {
      label: "licences",
      expected: 1,
      actual: await app.db.licence.count({ where: { schoolId } }),
    },
    {
      label: "academic years",
      expected: 1,
      actual: await app.db.academicYear.count({ where: { schoolId } }),
    },
    {
      label: "STUDENT_LOGIN events",
      expected: expectedEvents,
      actual: await app.db.learningEvent.count({
        where: { schoolId, type: "STUDENT_LOGIN" },
      }),
    },
  ];

  console.log("\nVerification:");
  const failures: string[] = [];
  for (const check of checks) {
    const ok = check.actual === check.expected;
    console.log(
      `  ${ok ? "ok " : "FAIL"} ${check.label}: ${check.actual} (expected ${check.expected})`,
    );
    if (!ok) failures.push(check.label);
  }
  if (failures.length > 0) {
    throw new Error(`Seed verification failed: ${failures.join(", ")}`);
  }
}

// ── Credentials output ────────────────────────────────────────────────────

async function writeCredentialsFile(
  classes: { name: string; joinCode: string | null }[],
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const byClass = (name: string) => STUDENTS.filter((s) => s.className === name);

  const lines: string[] = [
    "# Build Bunny — NITAQ Demo School credentials",
    "",
    `Generated by \`npm run db:seed\` on ${new Date().toISOString()}.`,
    `School code: **${DEMO_SCHOOL.code}** · This directory is gitignored — do not commit.`,
    "",
    `## Platform staff — sign in at ${appUrl}/login`,
    "",
    "| Role | Name | Email | Password |",
    "| --- | --- | --- | --- |",
    ...PLATFORM_STAFF.map(
      (s) => `| ${s.role} | ${s.displayName} | ${s.email} | \`${s.password}\` |`,
    ),
    "",
    `## School staff — sign in at ${appUrl}/login`,
    "",
    "| Role | Name | Email | Password |",
    "| --- | --- | --- | --- |",
    `| SCHOOL_ADMIN | ${SCHOOL_ADMIN.displayName} | ${SCHOOL_ADMIN.email} | \`${SCHOOL_ADMIN.password}\` |`,
    ...TEACHERS.map(
      (t) => `| TEACHER | ${t.displayName} (${t.title}) | ${t.email} | \`${t.password}\` |`,
    ),
    "",
    `## Students — sign in at ${appUrl}/student-login with school code \`${DEMO_SCHOOL.code}\``,
    "",
  ];

  for (const cls of classes) {
    lines.push(
      `### ${cls.name}${cls.joinCode ? ` (join code \`${cls.joinCode}\`)` : ""}`,
      "",
      "| Student | Username | Password | Student ID |",
      "| --- | --- | --- | --- |",
      ...byClass(cls.name).map(
        (s) =>
          `| ${studentDisplayName(s)} | \`${s.username}\` | \`${s.password}\` | ${s.studentIdentifier} |`,
      ),
      "",
    );
  }

  const outDir = path.join(__dirname, "seed-output");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "credentials.md");
  await writeFile(outPath, lines.join("\n"), "utf8");
  return outPath;
}

function printSummaryTable(): void {
  const rows = [
    ...PLATFORM_STAFF.map((s) => ({
      Account: s.email,
      Role: s.role,
      Password: s.password,
      "Sign in": "/login",
    })),
    {
      Account: SCHOOL_ADMIN.email,
      Role: "SCHOOL_ADMIN",
      Password: SCHOOL_ADMIN.password,
      "Sign in": "/login",
    },
    ...TEACHERS.map((t) => ({
      Account: t.email,
      Role: "TEACHER",
      Password: t.password,
      "Sign in": "/login",
    })),
    ...STUDENTS.map((s) => ({
      Account: `${DEMO_SCHOOL.code} / ${s.username}`,
      Role: "STUDENT",
      Password: s.password,
      "Sign in": "/student-login",
    })),
  ];
  console.table(rows);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Seeding NITAQ Demo School (code ${DEMO_SCHOOL.code})…\n`);
  const app = await loadAppModules();

  const school = await ensureSchool(app);
  await ensureLicence(app, school.id);
  const year = await ensureAcademicYear(app, school.id);

  for (const staff of PLATFORM_STAFF) {
    await ensureStaff(app, { schoolId: null, ...staff });
  }
  await ensureStaff(app, { schoolId: school.id, role: "SCHOOL_ADMIN", ...SCHOOL_ADMIN });

  const teacherIds = new Map<string, string>();
  for (const teacher of TEACHERS) {
    const { userId } = await ensureStaff(app, {
      schoolId: school.id,
      role: "TEACHER",
      email: teacher.email,
      displayName: teacher.displayName,
      title: teacher.title,
      password: teacher.password,
    });
    teacherIds.set(teacher.className, userId);
  }

  const classIds = new Map<string, string>();
  const classRecords: { name: string; joinCode: string | null }[] = [];
  for (const cls of CLASSES) {
    const record = await ensureClass(app, school.id, year.id, cls.name, cls.grade);
    classIds.set(cls.name, record.id);
    classRecords.push({ name: cls.name, joinCode: record.joinCode });
  }

  for (const teacher of TEACHERS) {
    const classId = classIds.get(teacher.className);
    const userId = teacherIds.get(teacher.className);
    if (!classId || !userId) throw new Error(`missing class/teacher for ${teacher.className}`);
    await ensureMembership(
      app, school.id, classId, userId, "TEACHER",
      `${teacher.displayName} → ${teacher.className}`,
    );
  }

  for (const [index, student] of STUDENTS.entries()) {
    const classId = classIds.get(student.className);
    if (!classId) throw new Error(`missing class for ${student.className}`);

    const { userId } = await ensureStudent(app, school.id, student);
    await ensureMembership(
      app, school.id, classId, userId, "STUDENT",
      `${studentDisplayName(student)} → ${student.className}`,
    );

    const trail = student.loginTrailDays
      ? recentSchoolDays(student.loginTrailDays, index)
      : null;
    await ensureStudentProgress(app, userId, student, trail);
    if (trail) await ensureLoginTrail(app, school.id, userId, student, trail);
  }

  await verifyCounts(app, school.id);

  const credentialsPath = await writeCredentialsFile(classRecords);
  console.log(`\nCredentials written to ${credentialsPath}`);
  console.log(`\nDone: ${stats.created} created, ${stats.skipped} skipped.\n`);
  printSummaryTable();

  await app.db.$disconnect();
}

main().catch(async (err) => {
  console.error("\nSeed failed:", err);
  process.exitCode = 1;
});
