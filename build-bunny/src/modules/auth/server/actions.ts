"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { getSessionContext } from "@/modules/auth/server/session";

/**
 * Change the caller's own password, and clear the forced-change flag as part
 * of the SAME server operation.
 *
 * This used to be two calls: the browser asked Better Auth to change the
 * password, then called a separate action that cleared mustChangePassword on
 * trust. Anyone signed in could call the second one on its own and walk past
 * a forced password change without ever changing anything — the guarantee
 * rested entirely on the order of two calls in client JavaScript.
 *
 * Now the change runs here, and the flag is only cleared on the path where
 * Better Auth has already verified the current password. There is no longer
 * an endpoint that clears the flag by itself.
 */

const changePasswordInput = z.object({
  currentPassword: z.string().min(1),
  // Mirrors the server's Better Auth minPasswordLength.
  newPassword: z.string().min(6),
});

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; code: "UNAUTHENTICATED" | "INVALID_PASSWORD" | "PASSWORD_TOO_SHORT" | "FAILED" };

export async function changePasswordAction(input: unknown): Promise<ChangePasswordResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, code: "UNAUTHENTICATED" };

  const parsed = changePasswordInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "PASSWORD_TOO_SHORT" };

  try {
    // Verifies currentPassword server-side and throws if it is wrong.
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (err) {
    const code = (err as { body?: { code?: string } })?.body?.code;
    if (code === "INVALID_PASSWORD") return { ok: false, code: "INVALID_PASSWORD" };
    if (code === "PASSWORD_TOO_SHORT") return { ok: false, code: "PASSWORD_TOO_SHORT" };
    console.error("[auth] changePassword failed:", err);
    return { ok: false, code: "FAILED" };
  }

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
  } catch (err) {
    // The password DID change; only the flag/audit write failed. Report
    // success rather than sending the user back to re-enter a password that
    // is already replaced — they will simply be asked to change it again.
    console.error("[auth] clearing mustChangePassword failed:", err);
  }

  return { ok: true };
}
