import "server-only";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";

/**
 * Certificate revocation — the issuer-side counterpart to issue.ts.
 *
 * The whole display path for a revoked certificate already existed and was
 * tested (the public verify page has a dedicated revoked card that withholds
 * every frozen detail); what was missing was any way to actually revoke one,
 * so in production a certificate could never become revoked no matter what
 * went wrong. This closes that.
 *
 * Deliberate choices:
 *  - The row is NEVER deleted. A revoked certificate must keep resolving at
 *    its public URL, otherwise a revoked serial is indistinguishable from a
 *    forged one — which is exactly backwards.
 *  - A reason is required. "Revoked" with no recorded why is not something a
 *    school can be answered with six months later.
 *  - Revoking twice is a no-op that keeps the ORIGINAL timestamp and reason:
 *    the first revocation is the true one, and a double-click must not
 *    quietly rewrite the record.
 */

export interface RevokeCertificateInput {
  certificateId: string;
  reason: string;
}

export interface RevokedCertificate {
  id: string;
  serial: string;
  revokedAt: Date;
  alreadyRevoked: boolean;
}

function requirePlatform(ctx: SessionContext): void {
  if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "NITAQ_ADMIN") {
    throw new Error("Certificate revocation is an issuer-side operation");
  }
}

export async function revokeCertificate(
  ctx: SessionContext,
  input: RevokeCertificateInput,
): Promise<RevokedCertificate> {
  requirePlatform(ctx);

  const certificate = await db.certificate.findUnique({
    where: { id: input.certificateId },
    select: { id: true, serial: true, schoolId: true, revokedAt: true, revokeReason: true },
  });
  if (!certificate) throw new NotFoundError("Certificate not found");

  if (certificate.revokedAt !== null) {
    return {
      id: certificate.id,
      serial: certificate.serial,
      revokedAt: certificate.revokedAt,
      alreadyRevoked: true,
    };
  }

  const revokedAt = new Date();
  await db.certificate.update({
    where: { id: certificate.id },
    data: { revokedAt, revokeReason: input.reason },
  });

  await audit({
    action: AUDIT.certificates.revoked,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId: certificate.schoolId,
    targetType: "certificate",
    targetId: certificate.id,
    meta: { serial: certificate.serial, reason: input.reason },
  });

  return { id: certificate.id, serial: certificate.serial, revokedAt, alreadyRevoked: false };
}
