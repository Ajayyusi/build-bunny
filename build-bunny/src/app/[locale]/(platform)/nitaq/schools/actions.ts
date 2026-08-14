"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  createSchoolWithAdmin,
  setSchoolActive,
  setSchoolFeatureFlag,
  setSchoolProgram,
  type CreateSchoolResult,
} from "@/modules/schools/server/platform-management";

const createInput = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9]+$/, "Letters and numbers only"),
  timezone: z.string().trim().min(1).max(60),
  licenceSeats: z.coerce.number().int().min(1).max(100000),
  licenceStartsAt: z.coerce.date(),
  licenceExpiresAt: z.coerce.date(),
  adminEmail: z.string().trim().email(),
  adminDisplayName: z.string().trim().min(1).max(120),
});

export async function createSchoolAction(
  input: unknown,
): Promise<ActionResult<CreateSchoolResult>> {
  return withAuth("schools:manage", createInput, (ctx, data) =>
    createSchoolWithAdmin(ctx, data),
  )(input);
}

const activeInput = z.object({ schoolId: z.string().min(1), active: z.boolean() });

export async function setSchoolActiveAction(input: unknown): Promise<ActionResult<void>> {
  return withAuth("schools:manage", activeInput, (ctx, { schoolId, active }) =>
    setSchoolActive(ctx, schoolId, active),
  )(input);
}

const featureInput = z.object({
  schoolId: z.string().min(1),
  key: z.string().min(1).max(60),
  enabled: z.boolean(),
});

/**
 * Toggling a school's feature flags is a profile write, not school
 * lifecycle — so it runs under school:profile:write, which the catalog has
 * granted since m1 and nothing had ever checked.
 */
export async function setSchoolFeatureFlagAction(input: unknown): Promise<ActionResult<void>> {
  return withAuth("school:profile:write", featureInput, (ctx, { schoolId, key, enabled }) =>
    setSchoolFeatureFlag(ctx, schoolId, key, enabled),
  )(input);
}

/** Empty string is how the picker sends "no programme" through a <select>. */
const programInput = z.object({
  schoolId: z.string().min(1),
  programId: z
    .string()
    .max(60)
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

export async function setSchoolProgramAction(input: unknown): Promise<ActionResult<void>> {
  return withAuth("school:profile:write", programInput, (ctx, { schoolId, programId }) =>
    setSchoolProgram(ctx, schoolId, programId),
  )(input);
}
