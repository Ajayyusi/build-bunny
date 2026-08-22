import "server-only";

import { randomInt } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  createStaff,
  createStudent,
  CREDENTIAL_PROVIDER,
  generateFriendlyPassword,
  resetPassword,
  setAccountDisabled,
  type CreatedCredentials,
} from "@/modules/auth/server/provisioning";
import { assertSeatAvailable } from "./seats";

/**
 * School-admin mutations (plan §1.2 school management surfaces). Every
 * function takes the SessionContext first and re-derives schoolId from it —
 * a caller-supplied userId/classId is always re-verified against that school
 * with a compound lookup before any write, so a tampered id from another
 * school resolves to NOT_FOUND instead of touching foreign data. These are
 * mutations, not reads, so (unlike queries.ts) they are not part of the
 * tenantScopedQueries registry — isolation is asserted directly in
 * tests/integration/school-admin.test.ts instead.
 */

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

function actorFrom(ctx: SessionContext) {
  return { userId: ctx.userId, role: ctx.role };
}

async function requireStaffInSchool(schoolId: string, userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, schoolId, role: "TEACHER" },
    select: { id: true },
  });
  if (!user) throw new NotFoundError("Teacher not found in this school");
  return user;
}

async function requireStudentInSchool(schoolId: string, userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, schoolId, role: "STUDENT" },
    select: { id: true },
  });
  if (!user) throw new NotFoundError("Student not found in this school");
  return user;
}

// ── Teachers ────────────────────────────────────────────────────────────

export async function createTeacher(
  ctx: SessionContext,
  input: { email: string; displayName: string; title?: string },
): Promise<CreatedCredentials> {
  const schoolId = requireSchool(ctx);
  return createStaff(actorFrom(ctx), {
    schoolId,
    email: input.email,
    displayName: input.displayName,
    role: "TEACHER",
    title: input.title,
  });
}

export async function resetTeacherPassword(
  ctx: SessionContext,
  userId: string,
): Promise<{ password: string }> {
  const schoolId = requireSchool(ctx);
  await requireStaffInSchool(schoolId, userId);
  return resetPassword(actorFrom(ctx), { userId, schoolId, isStudent: false });
}

export async function setTeacherDisabled(
  ctx: SessionContext,
  userId: string,
  disabled: boolean,
): Promise<void> {
  const schoolId = requireSchool(ctx);
  await requireStaffInSchool(schoolId, userId);
  await setAccountDisabled(actorFrom(ctx), { userId, schoolId, isStudent: false }, disabled);
}

// ── Students ────────────────────────────────────────────────────────────

export async function createStudentAccount(
  ctx: SessionContext,
  input: {
    username: string;
    displayName: string;
    studentIdentifier: string;
    grade: number;
    classId?: string;
  },
): Promise<CreatedCredentials> {
  const schoolId = requireSchool(ctx);
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { code: true },
  });
  if (!school) throw new NotFoundError("School not found");

  // Prevalidate the class BEFORE creating anything. It used to be checked
  // after the student existed, so a bad class id left a real account with no
  // class — a child who cannot be found on any roster.
  if (input.classId) {
    const klass = await db.class.findFirst({
      where: { id: input.classId, schoolId },
      select: { id: true },
    });
    if (!klass) throw new NotFoundError("Class not found in this school");
  }

  // Seat check, account and class membership in ONE transaction: the check
  // is worthless outside the transaction that inserts (two concurrent
  // requests would both pass it), and the membership must not be able to
  // fail independently of the account it belongs to.
  return db.$transaction(async (tx) => {
    await assertSeatAvailable(tx, schoolId);

    const created = await createStudent(
      actorFrom(ctx),
      {
        schoolId,
        schoolCode: school.code,
        username: input.username,
        displayName: input.displayName,
        studentIdentifier: input.studentIdentifier,
        grade: input.grade,
      },
      tx,
    );

    if (input.classId) {
      await tx.classMembership.create({
        data: { schoolId, classId: input.classId, userId: created.userId, role: "STUDENT" },
      });
    }

    return created;
  });
}

export async function resetStudentPassword(
  ctx: SessionContext,
  userId: string,
): Promise<{ password: string }> {
  const schoolId = requireSchool(ctx);
  await requireStudentInSchool(schoolId, userId);
  return resetPassword(actorFrom(ctx), { userId, schoolId, isStudent: true });
}

export async function setStudentDisabled(
  ctx: SessionContext,
  userId: string,
  disabled: boolean,
): Promise<void> {
  const schoolId = requireSchool(ctx);
  await requireStudentInSchool(schoolId, userId);
  await setAccountDisabled(actorFrom(ctx), { userId, schoolId, isStudent: true }, disabled);
}

/**
 * Hard-deletes a student (plan §1.2 / m5 §35 erasure right). Every child row
 * — StudentProfile, ClassMembership, StudentProgress, ActivityAttempt,
 * XpEvent, HintUsage, StudentDailyActivity, StudentAchievement,
 * TeacherFeedback, LearningEvent, Session, Account — cascades via
 * schema.prisma's `onDelete: Cascade` on the User relation; no extra cleanup
 * calls are needed or correct (a partial manual delete would race the FK
 * cascade). Certificate.studentUserId is the one deliberate SetNull FK, so
 * an already-issued certificate survives with its FROZEN display fields
 * (studentName/schoolName/title/starsEarned/levelsCount, captured at
 * issuance) — /verify/[slug] keeps resolving exactly as before. AuditLog has
 * no FK to User at all (schema comment: "audit records must survive account
 * erasure"), so the audit write below is safe to log the now-deleted id.
 */
export async function eraseStudent(
  ctx: SessionContext,
  userId: string,
): Promise<{ displayName: string; studentIdentifier: string }> {
  const schoolId = requireSchool(ctx);
  const user = await db.user.findFirst({
    where: { id: userId, schoolId, role: "STUDENT" },
    select: {
      displayName: true,
      studentProfile: { select: { studentIdentifier: true } },
    },
  });
  if (!user) throw new NotFoundError("Student not found in this school");

  const snapshot = {
    displayName: user.displayName,
    studentIdentifier: user.studentProfile?.studentIdentifier ?? "",
  };

  await db.user.delete({ where: { id: userId } });

  await audit({
    action: AUDIT.students.erased,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "student",
    targetId: userId,
    meta: snapshot,
  });

  return snapshot;
}

/** Bulk reset for the "reset all and print" credential sheet flow. */
export async function resetClassPasswords(
  ctx: SessionContext,
  classId: string,
): Promise<{ userId: string; displayName: string; username: string | null; password: string }[]> {
  const schoolId = requireSchool(ctx);
  const klass = await db.class.findFirst({
    where: { id: classId, schoolId },
    select: {
      memberships: {
        where: { schoolId, role: "STUDENT" },
        select: { user: { select: { id: true, displayName: true, displayUsername: true } } },
      },
    },
  });
  if (!klass) throw new NotFoundError("Class not found in this school");

  // All-or-nothing, because the failure mode here is the worst one in the
  // product: a sequential loop that died halfway had already invalidated
  // some children's passwords, then threw — so the operator got NO
  // credentials back for pupils who could no longer sign in, and the only
  // recovery was resetting the whole class again.
  //
  // Hashing is done first and outside the transaction (it is the slow part
  // and touches no rows), so the transaction is a short burst of writes that
  // either all land or all roll back.
  const prepared = await Promise.all(
    klass.memberships.map(async (membership) => {
      const password = generateFriendlyPassword();
      return {
        userId: membership.user.id,
        displayName: membership.user.displayName,
        username: membership.user.displayUsername,
        password,
        passwordHash: await hashPassword(password),
      };
    }),
  );

  await db.$transaction(
    async (tx) => {
      for (const student of prepared) {
        await tx.account.updateMany({
          where: { userId: student.userId, providerId: CREDENTIAL_PROVIDER },
          data: { password: student.passwordHash },
        });
        // Session revocation = deleting the framework's session rows.
        await tx.session.deleteMany({ where: { userId: student.userId } });
      }
    },
    // A full class is ~30 students × 2 statements; the 5s default is tight
    // on a cold connection and a timeout here would roll back the lot.
    { timeout: 30_000 },
  );

  for (const student of prepared) {
    await audit({
      action: AUDIT.students.passwordReset,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      schoolId,
      targetType: "user",
      targetId: student.userId,
    });
  }

  // Hashes never leave this function.
  return prepared.map((student) => ({
    userId: student.userId,
    displayName: student.displayName,
    username: student.username,
    password: student.password,
  }));
}

// ── Classes ─────────────────────────────────────────────────────────────

export interface CreateClassInput {
  name: string;
  grade: number;
  academicYearId?: string;
  /** Provisions a new academic year in the same transaction when the school has none yet. */
  newAcademicYear?: { name: string; startsAt: Date; endsAt: Date };
  teacherUserId?: string;
}

export async function createClass(ctx: SessionContext, input: CreateClassInput) {
  const schoolId = requireSchool(ctx);

  // Validate the teacher BEFORE anything is written. This used to run after
  // the academic year had been created, so naming a teacher from another
  // school left a brand-new year behind on a request that then failed.
  if (input.teacherUserId) {
    await requireStaffInSchool(schoolId, input.teacherUserId);
  }

  // Year, class and the teacher's membership commit together — a class with
  // no teacher attached looks unassigned rather than failed, which is the
  // sort of half-state nobody goes looking for.
  const klass = await db.$transaction(async (tx) => {
    let academicYearId: string;
    if (input.academicYearId) {
      const year = await tx.academicYear.findFirst({
        where: { id: input.academicYearId, schoolId },
        select: { id: true },
      });
      if (!year) throw new NotFoundError("Academic year not found in this school");
      academicYearId = year.id;
    } else {
      if (!input.newAcademicYear) {
        throw new NotFoundError("An academic year is required");
      }
      const year = await tx.academicYear.create({
        data: { schoolId, ...input.newAcademicYear, isActive: true },
      });
      academicYearId = year.id;
    }

    const created = await tx.class.create({
      data: { schoolId, academicYearId, name: input.name, grade: input.grade },
    });

    if (input.teacherUserId) {
      await tx.classMembership.create({
        data: { schoolId, classId: created.id, userId: input.teacherUserId, role: "TEACHER" },
      });
    }
    return created;
  });

  await audit({
    action: AUDIT.classes.created,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "class",
    targetId: klass.id,
    meta: { name: input.name, grade: input.grade },
  });

  return klass;
}

export interface UpdateClassInput {
  name?: string;
  grade?: number;
  teacherUserId?: string | null;
}

export async function updateClass(
  ctx: SessionContext,
  classId: string,
  input: UpdateClassInput,
): Promise<void> {
  const schoolId = requireSchool(ctx);
  const klass = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!klass) throw new NotFoundError("Class not found in this school");

  if (input.name !== undefined || input.grade !== undefined) {
    await db.class.update({
      where: { id: classId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.grade !== undefined ? { grade: input.grade } : {}),
      },
    });
  }

  if (input.teacherUserId !== undefined) {
    await db.classMembership.deleteMany({ where: { schoolId, classId, role: "TEACHER" } });
    if (input.teacherUserId !== null) {
      await requireStaffInSchool(schoolId, input.teacherUserId);
      await db.classMembership.create({
        data: { schoolId, classId, userId: input.teacherUserId, role: "TEACHER" },
      });
    }
  }

  await audit({
    action: AUDIT.classes.updated,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "class",
    targetId: classId,
  });
}

/** Crockford base32 (no I/L/O/U) — matches the seed's join-code convention. */
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomJoinCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CROCKFORD_ALPHABET[randomInt(CROCKFORD_ALPHABET.length)];
  }
  return code;
}

export async function rotateJoinCode(ctx: SessionContext, classId: string): Promise<string> {
  const schoolId = requireSchool(ctx);
  const klass = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!klass) throw new NotFoundError("Class not found in this school");

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomJoinCode();
    const clash = await db.class.findUnique({ where: { joinCode: code } });
    if (clash) continue;
    await db.class.update({ where: { id: classId }, data: { joinCode: code } });
    await audit({
      action: AUDIT.classes.joinCodeRotated,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      schoolId,
      targetType: "class",
      targetId: classId,
    });
    return code;
  }
  throw new Error("Could not generate a unique join code");
}

export async function addStudentToClass(
  ctx: SessionContext,
  classId: string,
  studentUserId: string,
): Promise<void> {
  const schoolId = requireSchool(ctx);
  const klass = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!klass) throw new NotFoundError("Class not found in this school");
  await requireStudentInSchool(schoolId, studentUserId);

  const existing = await db.classMembership.findUnique({
    where: { classId_userId: { classId, userId: studentUserId } },
  });
  if (existing) return; // already a member — idempotent

  await db.classMembership.create({
    data: { schoolId, classId, userId: studentUserId, role: "STUDENT" },
  });
  await audit({
    action: AUDIT.classes.rosterChanged,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "class",
    targetId: classId,
    meta: { added: studentUserId },
  });
}

export async function removeStudentFromClass(
  ctx: SessionContext,
  classId: string,
  studentUserId: string,
): Promise<void> {
  const schoolId = requireSchool(ctx);
  const klass = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!klass) throw new NotFoundError("Class not found in this school");

  await db.classMembership.deleteMany({
    where: { schoolId, classId, userId: studentUserId, role: "STUDENT" },
  });
  await audit({
    action: AUDIT.classes.rosterChanged,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "class",
    targetId: classId,
    meta: { removed: studentUserId },
  });
}
