"use server";

import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { RateLimitedError, withAuth, type ActionResult } from "@/modules/auth/server/guard";

import { createFamilyLinkCore, revokeFamilyLinksCore } from "./links";

/**
 * Family-link actions: teacher / school-admin only (students:write is the
 * staff grant both roles hold). The cores re-check that the child is in the
 * caller's school — and, for a teacher, in one of their own classes.
 */
const studentSchema = z.object({ studentUserId: z.string().min(1) });

/** Generous for a teacher working down a class list; stops a script. */
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export async function createFamilyLink(
  input: unknown,
): Promise<ActionResult<{ token: string; expiresAt: Date }>> {
  return withAuth("students:write", studentSchema, (ctx, data) => {
    if (!limiter.allow(ctx.userId)) throw new RateLimitedError("Too many link requests");
    return createFamilyLinkCore(ctx, data);
  })(input);
}

export async function revokeFamilyLink(input: unknown): Promise<ActionResult<{ revoked: number }>> {
  return withAuth("students:write", studentSchema, (ctx, data) => revokeFamilyLinksCore(ctx, data))(input);
}
