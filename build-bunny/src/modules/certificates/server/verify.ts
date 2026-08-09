import "server-only";

import { db } from "@/lib/db";
import { localizedText } from "@/modules/curriculum/schemas";

/**
 * Public certificate verification (m4-contracts pinned interface). NO
 * session — this backs the unauthenticated `/verify/[verifySlug]` page and a
 * QR scan from a printed certificate. Looks up ONLY by verifySlug (the
 * unguessable public key); the human-printed `serial` is never accepted
 * here, so it structurally cannot be used to probe for certificates.
 *
 * Exposes EXACTLY the PublicCertificate field set — never studentUserId,
 * schoolId, worldId/programId, or the certificate's own id. Unknown slugs
 * and "almost right" slugs are indistinguishable: both resolve to null.
 */
export interface PublicCertificate {
  valid: boolean;
  revoked: boolean;
  studentName: string;
  schoolName: string;
  title: { en: string; ar?: string };
  issuedAt: string;
  serial: string;
  starsEarned: number;
  levelsCount: number;
}

export async function verifyCertificate(verifySlug: string): Promise<PublicCertificate | null> {
  const certificate = await db.certificate.findUnique({
    where: { verifySlug },
    select: {
      studentName: true,
      schoolName: true,
      title: true,
      issuedAt: true,
      serial: true,
      starsEarned: true,
      levelsCount: true,
      revokedAt: true,
    },
  });
  if (!certificate) return null;

  const parsedTitle = localizedText.safeParse(certificate.title);
  const title = parsedTitle.success
    ? { en: parsedTitle.data.en, ar: parsedTitle.data.ar }
    : { en: certificate.serial };
  const revoked = certificate.revokedAt !== null;

  return {
    valid: !revoked,
    revoked,
    studentName: certificate.studentName,
    schoolName: certificate.schoolName,
    title,
    issuedAt: certificate.issuedAt.toISOString(),
    serial: certificate.serial,
    starsEarned: certificate.starsEarned,
    levelsCount: certificate.levelsCount,
  };
}
