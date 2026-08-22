import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { audit, AUDIT } from "@/lib/audit";
import { db } from "@/lib/db";
import { homePathForRole, isRole } from "@/modules/auth/roles";
import { NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";

/**
 * Impersonation start/stop (plan §1.2 / security doc §5). All session
 * mechanics — the new impersonated session, its cookie, expiry, and
 * restoring the original session on stop — come from Better Auth's admin
 * plugin (src/lib/auth.ts, adminRoles SUPER_ADMIN/NITAQ_ADMIN). This module
 * only adds the audit trail and the redirect target.
 */

export async function startImpersonation(
  ctx: SessionContext,
  target: { userId: string },
): Promise<{ redirectTo: string }> {
  // The school is loaded from the target user, never accepted from the
  // caller. It used to be passed in from the browser and written straight to
  // the audit log, so the one record proving "who entered which school's
  // data" was whatever the client said it was — the field an auditor would
  // trust most was the field easiest to forge.
  const targetUser = await db.user.findUnique({
    where: { id: target.userId },
    select: { id: true, schoolId: true, role: true },
  });
  if (!targetUser) throw new NotFoundError("User not found");

  const result = await auth.api.impersonateUser({
    headers: await headers(),
    body: { userId: target.userId },
  });
  await audit({
    action: AUDIT.impersonation.start,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    onBehalfOfUserId: target.userId,
    schoolId: targetUser.schoolId,
    targetType: "user",
    targetId: target.userId,
    // The impersonated session id makes the audit trail joinable to the
    // activity performed while impersonating, not just to its start.
    meta: { targetRole: targetUser.role, sessionId: result.session?.id ?? null },
  });
  const role = isRole(result.user.role) ? result.user.role : "STUDENT";
  return { redirectTo: homePathForRole(role) };
}

/**
 * Stops impersonation for the CURRENT (impersonated) session. Permission is
 * state-based, not role-based — while impersonating, ctx.role is the
 * TARGET's role (e.g. STUDENT), which never holds "impersonation:use", so
 * this deliberately does not go through withAuth/requirePermission. Only
 * `ctx.impersonatedBy !== null` gates it. The admin plugin's adminRoles
 * restriction guarantees impersonatedBy always names a platform admin, so
 * the restored session's home is always /nitaq.
 */
export async function stopImpersonation(
  ctx: SessionContext,
): Promise<{ redirectTo: string } | null> {
  if (!ctx.impersonatedBy) return null;
  await auth.api.stopImpersonating({ headers: await headers() });
  await audit({
    action: AUDIT.impersonation.stop,
    actorUserId: ctx.impersonatedBy,
    onBehalfOfUserId: ctx.userId,
    schoolId: ctx.schoolId,
    targetType: "user",
    targetId: ctx.userId,
  });
  return { redirectTo: "/nitaq" };
}
