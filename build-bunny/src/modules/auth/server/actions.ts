"use server";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { getSessionContext } from "@/modules/auth/server/session";

/**
 * Clears the forced-change flag after the user has changed their password via
 * Better Auth (authClient.changePassword verifies the current password and
 * rotates sessions). Deliberately takes no input: it can only ever act on the
 * caller's own account.
 */
export async function markPasswordChanged(): Promise<{ ok: boolean }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false };

  try {
    await db.user.update({
      where: { id: ctx.userId },
      data: { mustChangePassword: false },
    });
    await audit({
      action: AUDIT.auth.passwordChanged,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      schoolId: ctx.schoolId,
      targetType: "user",
      targetId: ctx.userId,
    });
    return { ok: true };
  } catch (err) {
    console.error("[auth] markPasswordChanged failed:", err);
    return { ok: false };
  }
}
