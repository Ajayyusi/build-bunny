"use server";

import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { RateLimitedError, withAuth, type ActionResult } from "@/modules/auth/server/guard";

import { inviteFamilyEmailCore, removeFamilyEmailCore, type FamilyEmailState } from "./email";
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
  // Its own permission so a school on a read-only licence can still switch
  // a link off (a link sent to the wrong person must always be stoppable).
  return withAuth("family:revoke", studentSchema, (ctx, data) => revokeFamilyLinksCore(ctx, data))(input);
}

/**
 * Weekly family email actions: teacher / school-admin only, the same grants
 * as family links. The cores re-check that the child is the caller's.
 */
const inviteSchema = z.object({
  studentUserId: z.string().min(1),
  email: z.string().trim().max(254).email(),
  locale: z.enum(["en", "ar"]),
});

/** Each invitation is a real email to a real inbox: keep it slow. */
const inviteLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 60_000 });

export async function inviteFamilyEmail(input: unknown): Promise<ActionResult<{ state: FamilyEmailState }>> {
  return withAuth("students:write", inviteSchema, (ctx, data) => {
    if (!inviteLimiter.allow(ctx.userId)) throw new RateLimitedError("Too many invitations");
    return inviteFamilyEmailCore(ctx, data);
  })(input);
}

export async function removeFamilyEmail(input: unknown): Promise<ActionResult<{ removed: number }>> {
  // Like switching off a family link, removing an address must work even on
  // a read-only licence.
  return withAuth("family:revoke", studentSchema, (ctx, data) => removeFamilyEmailCore(ctx, data))(input);
}
