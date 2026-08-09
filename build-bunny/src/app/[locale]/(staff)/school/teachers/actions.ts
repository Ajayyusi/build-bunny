"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  createTeacher,
  resetTeacherPassword,
  setTeacherDisabled,
} from "@/modules/schools/server/management";
import type { CreatedCredentials } from "@/modules/auth/server/provisioning";

const createInput = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional(),
});

export async function createTeacherAction(
  input: unknown,
): Promise<ActionResult<CreatedCredentials>> {
  return withAuth("staff:manage", createInput, (ctx, data) =>
    createTeacher(ctx, { ...data, title: data.title || undefined }),
  )(input);
}

const userIdInput = z.object({ userId: z.string().min(1) });

export async function resetTeacherPasswordAction(
  input: unknown,
): Promise<ActionResult<{ password: string }>> {
  return withAuth("credentials:reset", userIdInput, (ctx, { userId }) =>
    resetTeacherPassword(ctx, userId),
  )(input);
}

const disableInput = z.object({ userId: z.string().min(1), disabled: z.boolean() });

export async function setTeacherDisabledAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return withAuth("accounts:disable", disableInput, (ctx, { userId, disabled }) =>
    setTeacherDisabled(ctx, userId, disabled),
  )(input);
}
