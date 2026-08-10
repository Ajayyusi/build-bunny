import { db } from "@/lib/db";
import type { AuditOutcome, Prisma } from "@prisma/client";
import { getRequestId } from "@/lib/logger";

/**
 * Append-only audit trail (plan §0.1-1 / security doc §5). Every account
 * administration action, licence change, impersonation, and content status
 * change lands here. Audit writes must never break the main flow — failures
 * are logged, not thrown.
 */
export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  onBehalfOfUserId?: string | null;
  schoolId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  outcome?: AuditOutcome;
  requestId?: string | null;
  ip?: string | null;
  meta?: Prisma.InputJsonValue;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        actorRole: entry.actorRole ?? null,
        onBehalfOfUserId: entry.onBehalfOfUserId ?? null,
        schoolId: entry.schoolId ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        outcome: entry.outcome ?? "SUCCESS",
        // Falls back to whatever request/action context is active (set by
        // the attempts route or the withAuth guard) so callers deep in the
        // pipeline (e.g. certificate issuance from the grading transaction)
        // don't have to thread requestId through their own signatures.
        requestId: entry.requestId ?? getRequestId() ?? null,
        ip: entry.ip ?? null,
        meta: entry.meta,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", entry.action, err);
  }
}

/** Typed audit action constants — keep grep-able and consistent. */
export const AUDIT = {
  auth: {
    loginSuccess: "auth.login_success",
    loginFailed: "auth.login_failed",
    logout: "auth.logout",
    passwordChanged: "auth.password_changed",
    sessionRevoked: "auth.session_revoked",
  },
  students: {
    created: "students.created",
    updated: "students.updated",
    passwordReset: "students.password_reset",
    disabled: "students.disabled",
    enabled: "students.enabled",
    imported: "students.imported",
    erased: "students.erased",
  },
  staff: {
    created: "staff.created",
    updated: "staff.updated",
    passwordReset: "staff.password_reset",
    disabled: "staff.disabled",
    enabled: "staff.enabled",
  },
  schools: {
    created: "schools.created",
    updated: "schools.updated",
    deactivated: "schools.deactivated",
    reactivated: "schools.reactivated",
  },
  classes: {
    created: "classes.created",
    updated: "classes.updated",
    rosterChanged: "classes.roster_changed",
    joinCodeRotated: "classes.join_code_rotated",
  },
  impersonation: {
    start: "impersonation.start",
    stop: "impersonation.stop",
  },
  privacy: {
    dataExported: "privacy.data_exported",
  },
} as const;
