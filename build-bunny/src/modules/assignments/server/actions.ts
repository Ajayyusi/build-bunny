"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  closeAssignmentCore,
  createAssignmentCore,
  type CloseAssignmentInput,
  type CreateAssignmentInput,
} from "./mutations";

/**
 * Assignment server actions (m4 deliverable 6). withAuth checks
 * assignments:manage — TEACHER-only in the permission catalog — then the
 * cores in ./mutations.ts re-verify the caller actually teaches the class.
 */

const createAssignmentSchema = z
  .object({
    classId: z.string().min(1),
    target: z.enum(["WORLD", "MODULE", "LEVEL"]),
    worldId: z.string().min(1).optional(),
    moduleId: z.string().min(1).optional(),
    levelId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(120),
    note: z.string().trim().max(2000).optional(),
    dueAt: z.coerce.date().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.target === "WORLD" && !input.worldId) {
      ctx.addIssue({ code: "custom", message: "worldId is required", path: ["worldId"] });
    }
    if (input.target === "MODULE" && !input.moduleId) {
      ctx.addIssue({ code: "custom", message: "moduleId is required", path: ["moduleId"] });
    }
    if (input.target === "LEVEL" && !input.levelId) {
      ctx.addIssue({ code: "custom", message: "levelId is required", path: ["levelId"] });
    }
  });

export async function createAssignment(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return withAuth("assignments:manage", createAssignmentSchema, (ctx, data) =>
    createAssignmentCore(ctx, data as CreateAssignmentInput),
  )(input);
}

const closeAssignmentSchema = z.object({ assignmentId: z.string().min(1) });

export async function closeAssignment(
  input: unknown,
): Promise<ActionResult<{ closedAt: Date }>> {
  return withAuth("assignments:manage", closeAssignmentSchema, (ctx, data) =>
    closeAssignmentCore(ctx, data as CloseAssignmentInput),
  )(input);
}
