import "server-only";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";
import type { CertificateKind } from "@prisma/client";

/**
 * Tenant-scoped certificate queries (hard rule 1): SessionContext first,
 * schoolId derived from ctx only, compound lookups, registered below.
 */

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

function asTitle(value: unknown, fallback: string): LocalizedText {
  const parsed = localizedText.safeParse(value);
  return parsed.success ? parsed.data : { en: fallback };
}

export interface SchoolCertificateRow {
  id: string;
  studentUserId: string | null;
  studentName: string;
  kind: CertificateKind;
  title: LocalizedText;
  serial: string;
  verifySlug: string;
  issuedAt: string;
  revokedAt: string | null;
  starsEarned: number;
  levelsCount: number;
}

/** Every certificate issued to a student of the caller's own school (staff view). */
export async function listSchoolCertificates(
  ctx: SessionContext,
): Promise<SchoolCertificateRow[]> {
  const schoolId = requireSchool(ctx);
  const rows = await db.certificate.findMany({
    where: { schoolId },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      studentUserId: true,
      studentName: true,
      kind: true,
      title: true,
      serial: true,
      verifySlug: true,
      issuedAt: true,
      revokedAt: true,
      starsEarned: true,
      levelsCount: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    studentUserId: row.studentUserId,
    studentName: row.studentName,
    kind: row.kind,
    title: asTitle(row.title, row.serial),
    serial: row.serial,
    verifySlug: row.verifySlug,
    issuedAt: row.issuedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    starsEarned: row.starsEarned,
    levelsCount: row.levelsCount,
  }));
}

export interface MyCertificateRow {
  id: string;
  kind: CertificateKind;
  /** Frozen display fields (m4-contracts) — the CertificateSheet prints these, not live profile data. */
  studentName: string;
  schoolName: string;
  title: LocalizedText;
  serial: string;
  verifySlug: string;
  issuedAt: string;
  revokedAt: string | null;
  starsEarned: number;
  levelsCount: number;
}

/** The calling student's own certificates — compound (student + school) filter. */
export async function listMyCertificates(ctx: SessionContext): Promise<MyCertificateRow[]> {
  const schoolId = requireSchool(ctx);
  const rows = await db.certificate.findMany({
    where: { studentUserId: ctx.userId, schoolId },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      kind: true,
      studentName: true,
      schoolName: true,
      title: true,
      serial: true,
      verifySlug: true,
      issuedAt: true,
      revokedAt: true,
      starsEarned: true,
      levelsCount: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    studentName: row.studentName,
    schoolName: row.schoolName,
    title: asTitle(row.title, row.serial),
    serial: row.serial,
    verifySlug: row.verifySlug,
    issuedAt: row.issuedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    starsEarned: row.starsEarned,
    levelsCount: row.levelsCount,
  }));
}

/** Registry walked by the tenant-isolation test suite — every query above must be here. */
export const tenantScopedQueries = {
  listSchoolCertificates,
  listMyCertificates,
} as const;
