"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import { startImpersonation } from "@/modules/auth/server/impersonation";

const input = z.object({
  userId: z.string().min(1),
  schoolId: z.string().min(1).nullable(),
});

export async function impersonateUserAction(
  raw: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  return withAuth("impersonation:use", input, (ctx, { userId, schoolId }) =>
    startImpersonation(ctx, { userId, schoolId }),
  )(raw);
}
