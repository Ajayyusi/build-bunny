import "server-only";

import { db } from "@/lib/db";
import { NotFoundError } from "@/modules/auth/server/guard";

import { resolveAssignmentLevelIds } from "./scope";
import type { SessionContext } from "@/modules/auth/server/session";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";

/**
 * Assignment mutations (m4 deliverable 6). Creating an assignment force-opens
 * its target scope for every student in the class on top of normal
 * progression: recomputeUnlocks runs first (ordinary unlocks), then an
 * explicit createMany opens exactly the assigned levels with unlockSource
 * "ASSIGNMENT" — skipDuplicates means an already-unlocked/in-progress/completed
 * row is NEVER touched (no downgrades, per the m4 contract).
 */

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

/** Only a TEACHER who is a member of the class may manage its assignments. */
async function requireOwnedClass(
  ctx: SessionContext,
  schoolId: string,
  classId: string,
): Promise<{ id: string }> {
  if (ctx.role !== "TEACHER") {
    throw new NotFoundError("Class not found");
  }
  const membership = await db.classMembership.findFirst({
    where: { classId, schoolId, userId: ctx.userId, role: "TEACHER" },
    select: { classId: true },
  });
  if (!membership) throw new NotFoundError("Class not found");
  return { id: classId };
}

export interface CreateAssignmentInput {
  classId: string;
  target: "WORLD" | "MODULE" | "LEVEL";
  worldId?: string;
  moduleId?: string;
  levelId?: string;
  title: string;
  note?: string;
  dueAt?: Date;
}

export async function createAssignmentCore(
  ctx: SessionContext,
  input: CreateAssignmentInput,
): Promise<{ id: string }> {
  const schoolId = requireSchool(ctx);
  await requireOwnedClass(ctx, schoolId, input.classId);
  const levelIds = await resolveAssignmentLevelIds(input);

  const assignment = await db.assignment.create({
    data: {
      schoolId,
      classId: input.classId,
      createdById: ctx.userId,
      target: input.target,
      worldId: input.worldId ?? null,
      moduleId: input.moduleId ?? null,
      levelId: input.levelId ?? null,
      title: input.title,
      note: input.note ?? null,
      dueAt: input.dueAt ?? null,
    },
    select: { id: true },
  });

  const students = await db.classMembership.findMany({
    where: { classId: input.classId, schoolId, role: "STUDENT" },
    select: { userId: true },
  });

  for (const student of students) {
    // Ordinary progression first, then force-open exactly the assigned scope.
    await recomputeUnlocks(student.userId);
    await db.studentProgress.createMany({
      data: levelIds.map((levelId) => ({
        schoolId,
        studentUserId: student.userId,
        levelId,
        status: "UNLOCKED" as const,
        unlockSource: "ASSIGNMENT",
      })),
      skipDuplicates: true,
    });
  }

  return assignment;
}

export interface CloseAssignmentInput {
  assignmentId: string;
}

export async function closeAssignmentCore(
  ctx: SessionContext,
  input: CloseAssignmentInput,
): Promise<{ closedAt: Date }> {
  const schoolId = requireSchool(ctx);
  if (ctx.role !== "TEACHER") throw new NotFoundError("Assignment not found");

  const assignment = await db.assignment.findFirst({
    where: {
      id: input.assignmentId,
      schoolId,
      class: { memberships: { some: { userId: ctx.userId, role: "TEACHER", schoolId } } },
    },
    select: { id: true, closedAt: true },
  });
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.closedAt) return { closedAt: assignment.closedAt };

  const closedAt = new Date();
  await db.assignment.update({ where: { id: assignment.id }, data: { closedAt } });
  return { closedAt };
}
