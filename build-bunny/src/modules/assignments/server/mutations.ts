import "server-only";

import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/modules/auth/server/guard";
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

async function resolveAssignmentLevelIds(input: {
  target: "WORLD" | "MODULE" | "LEVEL";
  worldId?: string;
  moduleId?: string;
  levelId?: string;
}): Promise<string[]> {
  const publishedFilter = { status: "PUBLISHED" as const, publishedVersionId: { not: null } };
  if (input.target === "LEVEL") {
    if (!input.levelId) throw new ConflictError("LEVEL target requires levelId");
    const level = await db.level.findFirst({ where: { id: input.levelId, ...publishedFilter } });
    if (!level) throw new NotFoundError("Level not found or not published");
    return [level.id];
  }
  if (input.target === "MODULE") {
    if (!input.moduleId) throw new ConflictError("MODULE target requires moduleId");
    const levels = await db.level.findMany({
      where: { moduleId: input.moduleId, ...publishedFilter },
      select: { id: true },
    });
    if (levels.length === 0) throw new NotFoundError("Module has no published levels");
    return levels.map((l) => l.id);
  }
  // WORLD
  if (!input.worldId) throw new ConflictError("WORLD target requires worldId");
  const levels = await db.level.findMany({
    where: { module: { worldId: input.worldId }, ...publishedFilter },
    select: { id: true },
  });
  if (levels.length === 0) throw new NotFoundError("World has no published levels");
  return levels.map((l) => l.id);
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
