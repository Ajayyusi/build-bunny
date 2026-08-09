"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  addStudentToClass,
  createClass,
  removeStudentFromClass,
  rotateJoinCode,
  updateClass,
  type CreateClassInput,
} from "@/modules/schools/server/management";
import { getClassDetail } from "@/modules/schools/server/queries";

const createInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    grade: z.coerce.number().int().min(1).max(12),
    academicYearId: z.string().trim().min(1).optional(),
    newYearName: z.string().trim().min(1).max(40).optional(),
    newYearStart: z.coerce.date().optional(),
    newYearEnd: z.coerce.date().optional(),
    teacherUserId: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.academicYearId || (v.newYearName && v.newYearStart && v.newYearEnd), {
    message: "An academic year is required",
  });

export async function createClassAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return withAuth("classes:manage", createInput, (ctx, data) => {
    const payload: CreateClassInput = {
      name: data.name,
      grade: data.grade,
      teacherUserId: data.teacherUserId,
      ...(data.academicYearId
        ? { academicYearId: data.academicYearId }
        : {
            newAcademicYear: {
              name: data.newYearName!,
              startsAt: data.newYearStart!,
              endsAt: data.newYearEnd!,
            },
          }),
    };
    return createClass(ctx, payload);
  })(input);
}

const updateInput = z.object({
  classId: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  grade: z.coerce.number().int().min(1).max(12).optional(),
  teacherUserId: z.string().trim().min(1).nullable().optional(),
});

export async function updateClassAction(input: unknown): Promise<ActionResult<void>> {
  return withAuth("classes:manage", updateInput, (ctx, { classId, ...rest }) =>
    updateClass(ctx, classId, rest),
  )(input);
}

const classIdInput = z.object({ classId: z.string().min(1) });

export async function rotateJoinCodeAction(
  input: unknown,
): Promise<ActionResult<{ joinCode: string }>> {
  return withAuth("classes:manage", classIdInput, async (ctx, { classId }) => ({
    joinCode: await rotateJoinCode(ctx, classId),
  }))(input);
}

const rosterInput = z.object({ classId: z.string().min(1), studentUserId: z.string().min(1) });

export async function addStudentToClassAction(input: unknown): Promise<ActionResult<void>> {
  return withAuth("classes:manage", rosterInput, (ctx, { classId, studentUserId }) =>
    addStudentToClass(ctx, classId, studentUserId),
  )(input);
}

export async function removeStudentFromClassAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return withAuth("classes:manage", rosterInput, (ctx, { classId, studentUserId }) =>
    removeStudentFromClass(ctx, classId, studentUserId),
  )(input);
}

export type ClassDetail = NonNullable<Awaited<ReturnType<typeof getClassDetail>>>;

export async function getClassRosterAction(
  input: unknown,
): Promise<ActionResult<ClassDetail>> {
  return withAuth("classes:manage", classIdInput, async (ctx, { classId }) => {
    const detail = await getClassDetail(ctx, classId);
    if (!detail) throw new Error("Class not found");
    return detail;
  })(input);
}
