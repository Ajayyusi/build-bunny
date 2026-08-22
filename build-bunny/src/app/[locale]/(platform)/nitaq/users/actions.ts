"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import { startImpersonation } from "@/modules/auth/server/impersonation";

// Only the target user id is accepted. Role and school are loaded from the
// database inside startImpersonation, so nothing the browser sends can shape
// what the audit log records about this event.
const input = z.object({
  userId: z.string().min(1),
});

export async function impersonateUserAction(
  raw: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  return withAuth("impersonation:use", input, (ctx, { userId }) =>
    startImpersonation(ctx, { userId }),
  )(raw);
}
