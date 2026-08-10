"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  createStudentAccount,
  eraseStudent,
  resetClassPasswords,
  resetStudentPassword,
  setStudentDisabled,
} from "@/modules/schools/server/management";
import type { CreatedCredentials } from "@/modules/auth/server/provisioning";

const createInput = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9._-]+$/, "Lowercase letters, numbers, dots, hyphens and underscores only"),
  displayName: z.string().trim().min(1).max(120),
  studentIdentifier: z.string().trim().min(1).max(60),
  grade: z.coerce.number().int().min(1).max(12),
  classId: z.string().trim().min(1).optional(),
});

export async function createStudentAction(
  input: unknown,
): Promise<ActionResult<CreatedCredentials>> {
  return withAuth("students:manage", createInput, (ctx, data) =>
    createStudentAccount(ctx, data),
  )(input);
}

const userIdInput = z.object({ userId: z.string().min(1) });

export async function resetStudentPasswordAction(
  input: unknown,
): Promise<ActionResult<{ password: string }>> {
  return withAuth("credentials:reset", userIdInput, (ctx, { userId }) =>
    resetStudentPassword(ctx, userId),
  )(input);
}

const disableInput = z.object({ userId: z.string().min(1), disabled: z.boolean() });

export async function setStudentDisabledAction(input: unknown): Promise<ActionResult<void>> {
  return withAuth("accounts:disable", disableInput, (ctx, { userId, disabled }) =>
    setStudentDisabled(ctx, userId, disabled),
  )(input);
}

/**
 * Hard-delete erasure (m5 §35). SCHOOL_ADMIN only — "students:manage" is
 * not granted to TEACHER, unlike "students:write"/"credentials:reset".
 */
export async function eraseStudentAction(
  input: unknown,
): Promise<ActionResult<{ displayName: string; studentIdentifier: string }>> {
  return withAuth("students:manage", userIdInput, (ctx, { userId }) =>
    eraseStudent(ctx, userId),
  )(input);
}

const classIdInput = z.object({ classId: z.string().min(1) });

export async function resetClassPasswordsAction(
  input: unknown,
): Promise<
  ActionResult<{ userId: string; displayName: string; username: string | null; password: string }[]>
> {
  return withAuth("credentials:reset", classIdInput, (ctx, { classId }) =>
    resetClassPasswords(ctx, classId),
  )(input);
}
