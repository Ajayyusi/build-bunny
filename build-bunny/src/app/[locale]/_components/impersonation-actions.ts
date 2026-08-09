"use server";

import { stopImpersonation } from "@/modules/auth/server/impersonation";
import { getSessionContext } from "@/modules/auth/server/session";
import type { ActionResult } from "@/modules/auth/server/guard";

/**
 * Stop-impersonation is state-gated (ctx.impersonatedBy), not permission-
 * gated — see the doc comment on stopImpersonation for why this doesn't go
 * through withAuth. Shared by every shell (staff/platform/student) since the
 * banner they all render offers it. Takes no input.
 */
export async function stopImpersonatingAction(): Promise<ActionResult<{ redirectTo: string }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "UNAUTHENTICATED" };
  const result = await stopImpersonation(ctx);
  if (!result) return { ok: false, error: "FORBIDDEN" };
  return { ok: true, data: result };
}
