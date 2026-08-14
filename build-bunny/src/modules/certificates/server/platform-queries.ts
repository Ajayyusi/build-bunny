import "server-only";

import type { CertificateKind } from "@prisma/client";

import { db } from "@/lib/db";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";
import type { SessionContext } from "@/modules/auth/server/session";

/**
 * The platform-wide certificate registry — every certificate NITAQ has
 * issued, across every school.
 *
 * Cross-tenant by design, so it lives here rather than in queries.ts and is
 * NOT registered in tenantScopedQueries: the isolation rig asserts that a
 * registered query never returns another school's rows, which is the exact
 * opposite of this query's job. It is guarded the same way the other
 * deliberately cross-tenant readers are (schools/server/platform-queries.ts)
 * — a hard role check on every call, no session-derived schoolId.
 */

function requirePlatform(ctx: SessionContext): void {
  if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "NITAQ_ADMIN") {
    throw new Error("Platform-only query invoked with a non-platform session");
  }
}

export interface PlatformCertificateRow {
  id: string;
  schoolId: string;
  schoolName: string;
  studentName: string;
  kind: CertificateKind;
  title: LocalizedText;
  serial: string;
  verifySlug: string;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface PlatformCertificateSearch {
  /** Matches serial, student name, or school name (case-insensitive). */
  q?: string;
  /** Show only revoked certificates. */
  revokedOnly?: boolean;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function listPlatformCertificates(
  ctx: SessionContext,
  search: PlatformCertificateSearch = {},
): Promise<PlatformCertificateRow[]> {
  requirePlatform(ctx);
  const q = search.q?.trim() ?? "";

  const rows = await db.certificate.findMany({
    where: {
      ...(search.revokedOnly === true ? { revokedAt: { not: null } } : {}),
      ...(q.length > 0
        ? {
            OR: [
              // Serial is the human-readable number printed on the sheet —
              // the thing a school quotes when they ring up about one.
              { serial: { contains: q, mode: "insensitive" as const } },
              { studentName: { contains: q, mode: "insensitive" as const } },
              { schoolName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { issuedAt: "desc" },
    take: Math.min(search.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    select: {
      id: true,
      schoolId: true,
      schoolName: true,
      studentName: true,
      kind: true,
      title: true,
      serial: true,
      verifySlug: true,
      issuedAt: true,
      revokedAt: true,
      revokeReason: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    studentName: row.studentName,
    kind: row.kind,
    title: localizedText.parse(row.title),
    serial: row.serial,
    verifySlug: row.verifySlug,
    issuedAt: row.issuedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revokeReason: row.revokeReason,
  }));
}
