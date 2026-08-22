import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { hasPermission, type Permission } from "@/modules/auth/permissions";
import { isReadOnlyPermission } from "@/modules/auth/permissions";
import { homePathForRole, isRole, type Role } from "@/modules/auth/roles";
import {
  resolveEntitlement,
  UNRESTRICTED,
  type Entitlement,
} from "@/modules/schools/server/entitlement";

/** Absolute session TTL for students on shared classroom devices (12 h). */
const STUDENT_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;

export interface SessionContext {
  userId: string;
  role: Role;
  /** Null only for platform staff (SUPER_ADMIN / NITAQ_ADMIN). */
  schoolId: string | null;
  displayName: string;
  locale: string;
  avatarId: string | null;
  mustChangePassword: boolean;
  /** Set when a platform admin is impersonating this user's session. */
  impersonatedBy: string | null;
  sessionId: string;
  /**
   * What this user's school is currently entitled to. Resolved here so every
   * guard, action and route sees the same answer — checking it in layouts
   * only would leave server actions and API routes wide open.
   */
  entitlement: Entitlement;
}

/**
 * Authoritative session lookup — cached per request. Middleware is only
 * optimistic; every layout/action/route handler trusts THIS, nothing else.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { user } = session;
  if (!isRole(user.role)) return null;
  if (user.banned) return null;

  // Framework enforces its own expiry; students additionally get a hard
  // absolute TTL from session creation (shared devices, plan §0.1-1 policy).
  if (user.role === "STUDENT") {
    const createdAt = new Date(session.session.createdAt).getTime();
    if (Date.now() - createdAt > STUDENT_ABSOLUTE_TTL_MS) {
      await auth.api
        .revokeSession({
          headers: await headers(),
          body: { token: session.session.token },
        })
        .catch(() => {});
      return null;
    }
  }

  // Platform staff are unscoped and never gated — they have to be able to
  // reach a suspended school in order to un-suspend it.
  const schoolId = user.schoolId ?? null;
  const entitlement = schoolId ? await resolveEntitlement(schoolId) : UNRESTRICTED;

  return {
    userId: user.id,
    role: user.role,
    schoolId,
    displayName: user.displayName ?? user.name,
    locale: user.locale ?? "en",
    avatarId: user.avatarId ?? null,
    mustChangePassword: user.mustChangePassword ?? false,
    impersonatedBy: session.session.impersonatedBy ?? null,
    sessionId: session.session.id,
    entitlement,
  };
});

/**
 * Layout/page guard: require one of the given roles, redirecting to the login
 * page (unauthenticated) or the caller's own home (wrong shell).
 */
export async function requireRole(
  ...roles: [Role, ...Role[]]
): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!roles.includes(ctx.role)) redirect(homePathForRole(ctx.role));
  if (ctx.mustChangePassword) redirect("/change-password");
  // A blocked school stops here, on the request itself. Doing this in a
  // layout would have left every server action and API route reachable.
  if (!ctx.entitlement.canAccess) redirect("/licence");
  return ctx;
}

/** Guard for actions/routes: require a specific permission (throws, no redirect). */
export async function requirePermission(
  permission: Permission,
): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw new AuthError("UNAUTHENTICATED");
  if (!hasPermission(ctx.role, permission)) throw new AuthError("FORBIDDEN");
  if (!ctx.entitlement.canAccess) throw new AuthError("FORBIDDEN");
  // READ_ONLY may look but not change anything. Only WRITE permissions are
  // refused — blocking every permission would also have hidden a school's
  // own records from it, which is not what a read-only licence means.
  if (!ctx.entitlement.canWrite && !isReadOnlyPermission(permission)) {
    throw new AuthError("FORBIDDEN");
  }
  return ctx;
}

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
    this.name = "AuthError";
  }
}
