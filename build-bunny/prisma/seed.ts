import "dotenv/config";

import Module from "node:module";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { ACHIEVEMENTS } from "./seed-data/achievements";
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
  demoStage,
  studentDisplayName,
  type DemoStage,
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
  const { dryRunImport, commitImport } = await import(
    "../src/modules/curriculum/server/import"
  );
  const { publishLevel, transitionStatus } = await import(
    "../src/modules/curriculum/server/publish"
  );
  const { recomputeUnlocks } = await import("../src/modules/learning/server/adventure");
  const { XP_BY_DIFFICULTY } = await import("../src/modules/curriculum/schemas");
  const { issueWorldCertificate } = await import("../src/modules/certificates/server/issue");
  const { bundle } = await import("../content");
  return {
    db,
    audit,
    AUDIT,
    recordLearningEvent,
    createStaff,
    createStudent,
    dryRunImport,
    commitImport,
    publishLevel,
    transitionStatus,
    recomputeUnlocks,
    XP_BY_DIFFICULTY,
    issueWorldCertificate,
    bundle,
  };
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

/**
 * The N school days (Mon–Fri) ENDING `endDaysAgo` days back, oldest first —
 * one level completion per school day, stamped with a class-time hour
 * (10:00–13:00 Asia/Dubai = 06:00–09:00 UTC). Anchoring the END of the run on
 * the student's lastActiveDate keeps completion timestamps, streaks, and the
 * needs-attention story (Adam: silent for 3 weeks) mutually coherent.
 */
function schoolDaysEnding(count: number, endDaysAgo: number, salt: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(Date.now() - endDaysAgo * 24 * 60 * 60 * 1000);
  while (days.length < count) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const day = new Date(cursor);
      day.setUTCHours(6 + ((salt + days.length) % 3), (salt * 13 + days.length * 19) % 60, 0, 0);
      days.push(day);
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return days.reverse();
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

// ── Curriculum (M2) ───────────────────────────────────────────────────────

const PROGRAM_SLUG = "foundations";

/** Pulls the trailing `level:<slug>` segment out of an import diff label. */
function levelSlugFromLabel(label: string): string | null {
  const match = /\/level:([a-z0-9-]+)$/.exec(label);
  return match ? match[1]! : null;
}

/**
 * Imports the bundled content through the SAME service the platform import
 * wizard uses. The dry run decides idempotence: identical content = nothing
 * to commit (and no audit noise); any issue in the bundle aborts the seed.
 * Returns the slugs of levels the import actually changed (created OR
 * updated) — snapshots are immutable, so a content-only edit to an
 * ALREADY-PUBLISHED level (e.g. the m5 Arabic pass) updates its DRAFT fields
 * but does nothing to what students see until it is explicitly republished;
 * `ensureCurriculumPublished` uses this set to force exactly those levels
 * through a fresh `publishLevel` call even though their status is already
 * PUBLISHED.
 */
async function ensureCurriculumContent(app: App): Promise<Set<string>> {
  const dry = await app.dryRunImport(app.bundle);
  if (dry.issues.length > 0) {
    throw new Error(`content bundle has issues:\n  ${dry.issues.join("\n  ")}`);
  }
  if (dry.creates.length === 0 && dry.updates.length === 0) {
    logSkipped(`content bundle (${dry.unchanged.length} entities unchanged)`);
    return new Set();
  }
  const diff = await app.commitImport(SEED_ACTOR, app.bundle);
  if (diff.issues.length > 0) {
    throw new Error(`content import failed:\n  ${diff.issues.join("\n  ")}`);
  }
  logCreated(
    `content bundle (${diff.creates.length} created, ${diff.updates.length} updated, ${diff.unchanged.length} unchanged)`,
  );
  const changedLevelSlugs = new Set<string>();
  for (const label of [...diff.creates, ...diff.updates]) {
    const slug = levelSlugFromLabel(label);
    if (slug) changedLevelSlugs.add(slug);
  }
  return changedLevelSlugs;
}

/**
 * Publishes everything through the real pipeline: container statuses via
 * transitionStatus, each level via publishLevel (gates + LevelVersion
 * snapshot). Horizon worlds get PUBLISHED too — they carry no levels, and the
 * map only renders PUBLISHED worlds. Already-published levels are normally
 * left alone (never re-versioned on every seed run) EXCEPT the ones in
 * `changedLevelSlugs` — those had their DRAFT content just updated by
 * ensureCurriculumContent, so they are force-republished to mint a NEW
 * LevelVersion carrying the change (e.g. the m5 Arabic pass) rather than
 * silently sitting in the DRAFT row while students keep seeing the old
 * published snapshot.
 */
async function ensureCurriculumPublished(
  app: App,
  changedLevelSlugs: Set<string>,
): Promise<void> {
  for (const worldFx of app.bundle.worlds) {
    const world = await app.db.world.findUnique({
      where: { slug: worldFx.slug },
      select: { id: true, status: true },
    });
    if (!world) throw new Error(`world ${worldFx.slug} missing after import`);
    if (world.status === "PUBLISHED") {
      logSkipped(`world ${worldFx.slug} (PUBLISHED)`);
    } else {
      const result = await app.transitionStatus(SEED_ACTOR, "world", world.id, "PUBLISHED");
      if (!result.ok) {
        throw new Error(`world ${worldFx.slug} publish failed: ${result.issues.join("; ")}`);
      }
      logCreated(`world ${worldFx.slug} → PUBLISHED`);
    }

    if (worldFx.horizon) continue;
    const levels = await app.db.level.findMany({
      where: { module: { world: { slug: worldFx.slug } } },
      orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
      select: { id: true, slug: true, status: true, publishedVersionId: true },
    });
    for (const level of levels) {
      const alreadyPublished = level.status === "PUBLISHED" && level.publishedVersionId;
      const forceRepublish = alreadyPublished && changedLevelSlugs.has(level.slug);
      if (alreadyPublished && !forceRepublish) {
        logSkipped(`level ${level.slug} (PUBLISHED)`);
        continue;
      }
      const result = await app.publishLevel(SEED_ACTOR, level.id);
      if (!result.ok) {
        const failed = result.gates
          .filter((g) => !g.ok)
          .map((g) => `${g.gate}: ${g.issues.join(", ")}`);
        throw new Error(`level ${level.slug} failed publish gates — ${failed.join(" | ")}`);
      }
      logCreated(
        `level ${level.slug} → PUBLISHED v${result.version}${forceRepublish ? " (republished — content changed)" : ""}`,
      );
    }
  }

  const program = await app.db.program.findUnique({
    where: { slug: PROGRAM_SLUG },
    select: { id: true, status: true },
  });
  if (!program) throw new Error(`program ${PROGRAM_SLUG} missing after import`);
  if (program.status === "PUBLISHED") {
    logSkipped(`program ${PROGRAM_SLUG} (PUBLISHED)`);
  } else {
    const result = await app.transitionStatus(SEED_ACTOR, "program", program.id, "PUBLISHED");
    if (!result.ok) {
      throw new Error(`program ${PROGRAM_SLUG} publish failed: ${result.issues.join("; ")}`);
    }
    logCreated(`program ${PROGRAM_SLUG} → PUBLISHED`);
  }
}

/** Enables the program for the demo school + turns the adventure flag on. */
async function ensureSchoolProgram(app: App, schoolId: string): Promise<{ programId: string }> {
  const program = await app.db.program.findUnique({
    where: { slug: PROGRAM_SLUG },
    select: { id: true },
  });
  if (!program) throw new Error(`program ${PROGRAM_SLUG} not found`);

  const existing = await app.db.schoolProgram.findUnique({
    where: { schoolId_programId: { schoolId, programId: program.id } },
  });
  if (existing) {
    logSkipped(`school program ${PROGRAM_SLUG}`);
  } else {
    await app.db.schoolProgram.create({ data: { schoolId, programId: program.id } });
    logCreated(`school program ${PROGRAM_SLUG}`);
  }

  const school = await app.db.school.findUnique({
    where: { id: schoolId },
    select: { features: true },
  });
  const features =
    school && typeof school.features === "object" && school.features !== null && !Array.isArray(school.features)
      ? (school.features as Record<string, unknown>)
      : {};
  if (features.adventure === true) {
    logSkipped(`school feature adventure`);
  } else {
    await app.db.school.update({
      where: { id: schoolId },
      data: { features: { ...features, adventure: true } },
    });
    logCreated(`school feature adventure = true`);
  }

  return { programId: program.id };
}

/**
 * Key-order-insensitive serialization (Postgres jsonb does not preserve key
 * order) — the idempotence test for achievement definitions.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

/**
 * The 12 pinned achievement definitions, upserted by slug: new slugs are
 * created, drifted definitions are re-aligned to the fixture, identical ones
 * are skipped — earned StudentAchievement rows always survive.
 */
async function ensureAchievements(app: App): Promise<void> {
  for (const def of ACHIEVEMENTS) {
    const existing = await app.db.achievement.findUnique({ where: { slug: def.slug } });
    // Prisma's InputJsonValue rejects Record<string, unknown> structurally;
    // the fixture criteria are plain JSON by construction.
    const criteria = def.criteria as Prisma.InputJsonValue;
    if (!existing) {
      await app.db.achievement.create({
        data: {
          slug: def.slug,
          name: def.name,
          description: def.description,
          icon: def.icon,
          criteria,
          order: def.order,
        },
      });
      logCreated(`achievement ${def.slug} ${def.icon}`);
      continue;
    }
    const current = {
      name: existing.name,
      description: existing.description,
      icon: existing.icon,
      criteria: existing.criteria,
      order: existing.order,
    };
    const target = {
      name: def.name,
      description: def.description,
      icon: def.icon,
      criteria,
      order: def.order,
    };
    if (stableStringify(current) === stableStringify(target)) {
      logSkipped(`achievement ${def.slug}`);
      continue;
    }
    await app.db.achievement.update({ where: { slug: def.slug }, data: target });
    logCreated(`achievement ${def.slug} (definition re-aligned)`);
  }
}

/** One published level in global program order, with its resolved XP + version. */
interface SeedLevel {
  id: string;
  slug: string;
  worldId: string;
  worldSlug: string;
  xp: number;
  version: number;
}

/**
 * The program's PUBLISHED levels in map order (program world order → module
 * order → level order) — the axis the per-student completedStars arrays index
 * into, with XP resolved the same way the snapshot does (explicit xpReward or
 * difficulty default).
 */
async function loadPublishedCurriculum(app: App): Promise<SeedLevel[]> {
  const programWorlds = await app.db.programWorld.findMany({
    where: { program: { slug: PROGRAM_SLUG }, world: { horizon: false } },
    orderBy: { order: "asc" },
    select: {
      world: {
        select: {
          id: true,
          slug: true,
          modules: {
            orderBy: { order: "asc" },
            select: {
              levels: {
                where: { status: "PUBLISHED", publishedVersionId: { not: null } },
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  slug: true,
                  xpReward: true,
                  difficulty: true,
                  publishedVersionId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const flat = programWorlds.flatMap(({ world }) =>
    world.modules.flatMap((mod) =>
      mod.levels.map((level) => ({ world, level })),
    ),
  );
  const versions = await app.db.levelVersion.findMany({
    where: { id: { in: flat.map((f) => f.level.publishedVersionId as string) } },
    select: { id: true, version: true },
  });
  const versionById = new Map(versions.map((v) => [v.id, v.version]));

  return flat.map(({ world, level }) => ({
    id: level.id,
    slug: level.slug,
    worldId: world.id,
    worldSlug: world.slug,
    xp: level.xpReward ?? app.XP_BY_DIFFICULTY[level.difficulty],
    version: versionById.get(level.publishedVersionId as string) ?? 1,
  }));
}

/** Pins the student to the demo program (never overrides an existing pin). */
async function ensureProgramPin(
  app: App,
  userId: string,
  programId: string,
  student: StudentSeed,
): Promise<void> {
  const profile = await app.db.studentProfile.findUnique({
    where: { userId },
    select: { programId: true },
  });
  if (!profile) throw new Error(`missing StudentProfile for ${student.username}`);
  if (profile.programId) {
    logSkipped(`program pin for ${student.username}`);
    return;
  }
  await app.db.studentProfile.update({ where: { userId }, data: { programId } });
  logCreated(`program pin for ${student.username} → ${PROGRAM_SLUG}`);
}

/**
 * COMPLETED StudentProgress rows for the student's first N curriculum levels
 * (N = completedStars.length), one per school day ending on the student's
 * lastActiveDate. Self-healing guard: any existing progress row means a demo
 * user (or an earlier run) already played — never touch it.
 */
async function ensureLevelProgress(
  app: App,
  curriculum: SeedLevel[],
  schoolId: string,
  userId: string,
  student: StudentSeed,
  salt: number,
): Promise<void> {
  const stars = student.progress.completedStars;
  if (stars.length > curriculum.length) {
    throw new Error(`${student.username}: completedStars longer than the curriculum`);
  }
  const existing = await app.db.studentProgress.count({
    where: { studentUserId: userId },
  });
  if (existing > 0) {
    logSkipped(`level progress for ${student.username} (${existing} rows)`);
    return;
  }
  if (stars.length === 0) return; // fresh — recomputeUnlocks opens level 1

  const dates = schoolDaysEnding(
    stars.length,
    student.progress.lastActiveDaysAgo ?? 0,
    salt,
  );
  await app.db.studentProgress.createMany({
    data: stars.map((starCount, i) => ({
      schoolId,
      studentUserId: userId,
      levelId: curriculum[i]!.id,
      status: "COMPLETED" as const,
      stars: starCount,
      attemptsCount: 1 + ((salt + i) % 3),
      unlockSource: "SEED",
      firstCompletedAt: dates[i]!,
      lastActivityAt: dates[i]!,
      completedVersion: curriculum[i]!.version,
    })),
    skipDuplicates: true,
  });
  logCreated(
    `level progress for ${student.username} (${stars.length}/${curriculum.length} levels COMPLETED)`,
  );
}

/**
 * xpTotal/starsTotal recomputed from the student's actual COMPLETED rows.
 * The principled guard would be "only overwrite caches when the student has
 * zero ActivityAttempt rows" — that table lands in M3, so for demo-school
 * students we ALWAYS recompute (one-time migration away from the invented M1
 * numbers, e.g. Aisha's 840 XP with no rows behind it). Streak fields are
 * deliberately left alone.
 */
async function ensureProfileCaches(
  app: App,
  curriculum: SeedLevel[],
  userId: string,
  student: StudentSeed,
): Promise<void> {
  const rows = await app.db.studentProgress.findMany({
    where: { studentUserId: userId, status: "COMPLETED" },
    select: { levelId: true, stars: true },
  });
  const xpByLevel = new Map(curriculum.map((l) => [l.id, l.xp]));
  const xpTotal = rows.reduce((sum, r) => sum + (xpByLevel.get(r.levelId) ?? 0), 0);
  const starsTotal = rows.reduce((sum, r) => sum + r.stars, 0);

  const profile = await app.db.studentProfile.findUnique({
    where: { userId },
    select: { xpTotal: true, starsTotal: true },
  });
  if (!profile) throw new Error(`missing StudentProfile for ${student.username}`);
  if (profile.xpTotal === xpTotal && profile.starsTotal === starsTotal) {
    logSkipped(`caches for ${student.username} (${xpTotal} XP, ${starsTotal} stars)`);
    return;
  }
  await app.db.studentProfile.update({
    where: { userId },
    data: { xpTotal, starsTotal },
  });
  logCreated(
    `caches for ${student.username} (${profile.xpTotal}→${xpTotal} XP, ${profile.starsTotal}→${starsTotal} stars)`,
  );
}

/**
 * Streak/activity bootstrap — the surviving half of the old M1 progress
 * seeding. Only touches profiles that are still untouched on these fields so
 * re-seeding never clobbers real demo usage.
 */
async function ensureStreaks(
  app: App,
  userId: string,
  student: StudentSeed,
  trail: Date[] | null,
): Promise<void> {
  const { progress } = student;
  if (progress.streakBest === 0 && progress.lastActiveDaysAgo === null) {
    return; // fresh — profile defaults already say "never signed in"
  }
  const profile = await app.db.studentProfile.findUnique({
    where: { userId },
    select: { streakCurrent: true, streakBest: true, lastActiveDate: true },
  });
  if (!profile) throw new Error(`missing StudentProfile for ${student.username}`);
  const untouched =
    profile.streakCurrent === 0 && profile.streakBest === 0 && profile.lastActiveDate === null;
  if (!untouched) {
    logSkipped(`streaks for ${student.username}`);
    return;
  }
  const lastTrailDay = trail?.[trail.length - 1];
  const lastActiveDate =
    lastTrailDay ??
    (progress.lastActiveDaysAgo !== null ? daysAgo(progress.lastActiveDaysAgo) : null);
  await app.db.studentProfile.update({
    where: { userId },
    data: {
      streakCurrent: progress.streakCurrent,
      streakBest: progress.streakBest,
      lastActiveDate,
      onboardedAt: lastActiveDate,
    },
  });
  logCreated(`streaks for ${student.username} (${progress.streakCurrent}/${progress.streakBest})`);
}

/**
 * LEVEL_COMPLETED / WORLD_COMPLETED trail for the demo-active students (the
 * ones that also carry a login trail), through the real recordLearningEvent
 * path and backdated afterwards — same technique as the login trail, but
 * matched by levelId/worldId so it is deterministic regardless of insert
 * order. Timestamps mirror the StudentProgress completion dates.
 */
async function ensureCompletionEvents(
  app: App,
  curriculum: SeedLevel[],
  schoolId: string,
  userId: string,
  student: StudentSeed,
): Promise<void> {
  if (!student.loginTrailDays) return; // only the 5 active students get a trail
  const existing = await app.db.learningEvent.count({
    where: { studentUserId: userId, type: "LEVEL_COMPLETED" },
  });
  if (existing > 0) {
    logSkipped(`completion events for ${student.username} (${existing} events)`);
    return;
  }
  const rows = await app.db.studentProgress.findMany({
    where: { studentUserId: userId, status: "COMPLETED", firstCompletedAt: { not: null } },
    select: { levelId: true, stars: true, firstCompletedAt: true },
    orderBy: { firstCompletedAt: "asc" },
  });
  if (rows.length === 0) return;

  const levelById = new Map(curriculum.map((l) => [l.id, l]));
  const dateByLevelId = new Map<string, Date>();
  for (const row of rows) {
    const level = levelById.get(row.levelId);
    if (!level) continue;
    dateByLevelId.set(row.levelId, row.firstCompletedAt!);
    await app.recordLearningEvent({
      type: "LEVEL_COMPLETED",
      schoolId,
      studentUserId: userId,
      levelId: row.levelId,
      worldId: level.worldId,
      meta: { stars: row.stars, seed: true },
    });
  }

  // A world is completed when every one of its levels is — event stamped 30
  // minutes after the world's final level completion.
  const completedIds = new Set(rows.map((r) => r.levelId));
  const dateByWorldId = new Map<string, Date>();
  const worldIds = [...new Set(curriculum.map((l) => l.worldId))];
  for (const worldId of worldIds) {
    const worldLevels = curriculum.filter((l) => l.worldId === worldId);
    if (!worldLevels.every((l) => completedIds.has(l.id))) continue;
    const last = worldLevels
      .map((l) => dateByLevelId.get(l.id)!)
      .reduce((a, b) => (a > b ? a : b));
    const at = new Date(last.getTime() + 30 * 60 * 1000);
    dateByWorldId.set(worldId, at);
    await app.recordLearningEvent({
      type: "WORLD_COMPLETED",
      schoolId,
      studentUserId: userId,
      worldId,
      meta: { seed: true },
    });
  }

  // Backdate: recordLearningEvent stamps createdAt=now; rewrite it from the
  // level/world the event points at (safe: the count guard above means every
  // fetched row was written by this run).
  const events = await app.db.learningEvent.findMany({
    where: { studentUserId: userId, type: { in: ["LEVEL_COMPLETED", "WORLD_COMPLETED"] } },
    select: { id: true, type: true, levelId: true, worldId: true },
  });
  await Promise.all(
    events.map((event) => {
      const at =
        event.type === "LEVEL_COMPLETED"
          ? dateByLevelId.get(event.levelId ?? "")
          : dateByWorldId.get(event.worldId ?? "");
      return at
        ? app.db.learningEvent.update({ where: { id: event.id }, data: { createdAt: at } })
        : Promise.resolve(null);
    }),
  );
  logCreated(
    `completion events for ${student.username} (${dateByLevelId.size} levels, ${dateByWorldId.size} worlds)`,
  );
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

/**
 * Certificates through the REAL issuance path (m4 task contract) — walks
 * every non-horizon world in the curriculum and calls issueWorldCertificate
 * for it. That function is the single owner of "genuine full-PASS"
 * eligibility (every published level of the world COMPLETED at the level's
 * own star threshold, never just a PARTIAL) and is idempotent by the
 * (student, kind, world) unique, so this is safe to re-run on every seed
 * pass, and a not-yet-eligible world simply comes back with no certificate.
 *
 * The seed deliberately does NOT pre-filter by stars itself. It used to, with
 * a copy of the `stars >= 2` rule, which silently went wrong the moment a
 * world gained a level that awards no stars at all (bunny-meadow's Learn
 * step): the copy said "not eligible" and no certificate was ever issued.
 * Walking every world (rather than special-casing Aisha by username) likewise
 * keeps the seed correct if the demo roster's progress ever changes.
 */
async function ensureCertificates(
  app: App,
  curriculum: SeedLevel[],
  schoolId: string,
  userId: string,
  student: StudentSeed,
): Promise<void> {
  const worldIds = [...new Set(curriculum.map((l) => l.worldId))];
  for (const worldId of worldIds) {
    const result = await app.issueWorldCertificate({ schoolId, studentUserId: userId, worldId });
    if (!result.certificate) continue; // not eligible yet — the ordinary case
    const worldSlug = curriculum.find((l) => l.worldId === worldId)!.worldSlug;
    if (result.alreadyIssued) {
      logSkipped(`certificate ${student.username} · ${worldSlug} (${result.certificate.serial})`);
    } else {
      logCreated(`certificate ${student.username} · ${worldSlug} (${result.certificate.serial})`);
    }
  }
}

// ── Verification ──────────────────────────────────────────────────────────

async function verifyCounts(
  app: App,
  schoolId: string,
  curriculum: SeedLevel[],
): Promise<void> {
  const expectedEvents = STUDENTS.reduce((n, s) => n + (s.loginTrailDays ?? 0), 0);
  const expectedCompleted = STUDENTS.reduce(
    (n, s) => n + s.progress.completedStars.length,
    0,
  );
  const expectedCompletionEvents = STUDENTS.reduce(
    (n, s) => n + (s.loginTrailDays ? s.progress.completedStars.length : 0),
    0,
  );
  // Real demo usage (logins, level completions) legitimately grows these
  // streams past what the seed wrote — those checks are lower bounds.
  const checks: { label: string; expected: number; actual: number; atLeast?: boolean }[] = [
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
      atLeast: true,
      actual: await app.db.learningEvent.count({
        where: { schoolId, type: "STUDENT_LOGIN" },
      }),
    },
    {
      label: "published levels",
      expected: curriculum.length,
      actual: await app.db.level.count({
        where: { status: "PUBLISHED", publishedVersionId: { not: null } },
      }),
    },
    {
      label: "level versions",
      expected: curriculum.length,
      atLeast: true,
      actual: await app.db.levelVersion.count(),
    },
    {
      label: "achievement definitions",
      expected: ACHIEVEMENTS.length,
      actual: await app.db.achievement.count(),
    },
    {
      label: "school programs",
      expected: 1,
      actual: await app.db.schoolProgram.count({ where: { schoolId } }),
    },
    {
      label: "program-pinned profiles",
      expected: STUDENTS.length,
      actual: await app.db.studentProfile.count({
        where: { schoolId, programId: { not: null } },
      }),
    },
    {
      label: "COMPLETED progress rows",
      expected: expectedCompleted,
      atLeast: true,
      actual: await app.db.studentProgress.count({
        where: { schoolId, status: "COMPLETED" },
      }),
    },
    {
      // Every non-finished student must have an open next level: fresh get
      // level 1, everyone below 10/10 gets their next one — so rows strictly
      // exceed the completed count.
      label: "progress rows incl. unlocks",
      expected: expectedCompleted + 1,
      atLeast: true,
      actual: await app.db.studentProgress.count({ where: { schoolId } }),
    },
    {
      label: "LEVEL_COMPLETED events",
      expected: expectedCompletionEvents,
      atLeast: true,
      actual: await app.db.learningEvent.count({
        where: { schoolId, type: "LEVEL_COMPLETED" },
      }),
    },
    {
      // Aisha K. is the only student who has genuinely passed every level of
      // two full worlds (Bunny Meadow + Logic Forest) — a lower bound since
      // real demo play can only add more.
      label: "certificates issued",
      expected: 2,
      atLeast: true,
      actual: await app.db.certificate.count({ where: { schoolId } }),
    },
  ];

  console.log("\nVerification:");
  const failures: string[] = [];
  for (const check of checks) {
    const ok = check.atLeast
      ? check.actual >= check.expected
      : check.actual === check.expected;
    console.log(
      `  ${ok ? "ok " : "FAIL"} ${check.label}: ${check.actual} (expected ${check.atLeast ? "≥ " : ""}${check.expected})`,
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
  totalLevels: number,
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

  // ── Demo state footer — where each student sits in the adventure ──
  const stageTitles: Record<DemoStage, string> = {
    fresh: "Fresh (never played — level 1 unlocked, nothing else)",
    "mid-world-1": "Mid World 1 (Bunny Meadow in progress)",
    "into-world-2": "Finished World 1, into World 2 (Logic Forest)",
    advanced: "Advanced (World 2 nearly or fully complete)",
  };
  const describe = (s: StudentSeed): string => {
    const n = s.progress.completedStars.length;
    // Seeded progress covers Worlds 1–2 (10 levels); Robot Lab (levels
    // 11–15) opens via the tightened world gate once Worlds 1–2 are done.
    const certificate =
      n === 10
        ? " — **Worlds 1–2 complete, certificates issued** (Robot Lab unlocked; verify at /verify/[slug])"
        : "";
    return `- ${studentDisplayName(s)} (\`${s.username}\`): ${n}/${totalLevels} levels${certificate}`;
  };
  lines.push("## Demo state", "");
  for (const stage of ["advanced", "into-world-2", "mid-world-1", "fresh"] as DemoStage[]) {
    const group = STUDENTS.filter((s) => demoStage(s) === stage);
    if (group.length === 0) continue;
    lines.push(`### ${stageTitles[stage]}`, "", ...group.map(describe), "");
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

  // Curriculum before students: progress rows and unlocks need published
  // levels + the enabled program to exist.
  console.log("\nCurriculum:");
  const changedLevelSlugs = await ensureCurriculumContent(app);
  await ensureCurriculumPublished(app, changedLevelSlugs);
  await ensureAchievements(app);
  const { programId } = await ensureSchoolProgram(app, school.id);
  const curriculum = await loadPublishedCurriculum(app);
  console.log(`  · ${curriculum.length} published levels in program order\n`);

  for (const [index, student] of STUDENTS.entries()) {
    const classId = classIds.get(student.className);
    if (!classId) throw new Error(`missing class for ${student.className}`);

    const { userId } = await ensureStudent(app, school.id, student);
    await ensureMembership(
      app, school.id, classId, userId, "STUDENT",
      `${studentDisplayName(student)} → ${student.className}`,
    );

    await ensureProgramPin(app, userId, programId, student);
    await ensureLevelProgress(app, curriculum, school.id, userId, student, index);
    // Materializes the next UNLOCKED row (ORDER/PREREQUISITE) after the
    // seeded completions — same engine the app runs after a real completion.
    await app.recomputeUnlocks(userId);
    await ensureProfileCaches(app, curriculum, userId, student);

    const trail = student.loginTrailDays
      ? recentSchoolDays(student.loginTrailDays, index)
      : null;
    await ensureStreaks(app, userId, student, trail);
    if (trail) await ensureLoginTrail(app, school.id, userId, student, trail);
    await ensureCompletionEvents(app, curriculum, school.id, userId, student);
    await ensureCertificates(app, curriculum, school.id, userId, student);
  }

  await verifyCounts(app, school.id, curriculum);

  const credentialsPath = await writeCredentialsFile(classRecords, curriculum.length);
  console.log(`\nCredentials written to ${credentialsPath}`);
  console.log(`\nDone: ${stats.created} created, ${stats.skipped} skipped.\n`);
  printSummaryTable();

  await app.db.$disconnect();
}

main().catch(async (err) => {
  console.error("\nSeed failed:", err);
  process.exitCode = 1;
});
