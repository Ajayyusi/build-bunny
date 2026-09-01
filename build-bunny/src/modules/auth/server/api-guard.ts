import "server-only";

import { NextResponse } from "next/server";

import { hasPermission, isReadOnlyPermission, type Permission } from "@/modules/auth/permissions";
import { getSessionContext, type SessionContext } from "@/modules/auth/server/session";

/**
 * The route-handler equivalent of requirePermission.
 *
 * Route handlers cannot use requirePermission directly — it throws an
 * AuthError that only the withAuth wrapper knows how to turn into a result —
 * so each one hand-rolled `getSessionContext` + `hasPermission`. That was
 * fine until entitlement enforcement arrived: the licence checks live inside
 * requirePermission, so every hand-rolled copy silently skipped them, and a
 * SUSPENDED or EXPIRED school could still export its full student roster
 * through /api/school/reports/* while every other surface refused it.
 *
 * Applies exactly the same three rules, in the same order, so a route and an
 * action can never disagree about who may do what:
 *   1. signed in
 *   2. role holds the permission
 *   3. the school's licence permits it — and for a READ_ONLY licence, reads
 *      still work while writes do not
 *
 * Returns either the context or the response to send. Callers do:
 *   const gate = await requireApiPermission("exports:school");
 *   if (gate instanceof NextResponse) return gate;
 */
export async function requireApiPermission(
  permission: Permission,
): Promise<SessionContext | NextResponse> {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!hasPermission(ctx.role, permission)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!ctx.entitlement.canAccess) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!ctx.entitlement.canWrite && !isReadOnlyPermission(permission)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return ctx;
}
