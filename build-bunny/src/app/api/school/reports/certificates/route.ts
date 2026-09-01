import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { csvHeaders, toCsvBody } from "@/lib/csv";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
import { resolveText } from "@/modules/curriculum/schemas";
import { listSchoolCertificates } from "@/modules/certificates/server/queries";

/**
 * GET /api/school/reports/certificates — CSV export of every certificate
 * issued to this school's students (M5 analytics & reports §4). Reuses the
 * existing tenant-scoped listSchoolCertificates (m4) rather than adding a
 * new query. Formula-injection neutralized via @/lib/csv.
 */
export async function GET() {
  // Shared guard: role AND licence entitlement, the same rule server actions
  // run under. Hand-rolling it here skipped the licence check entirely, so a
  // suspended school could still export its roster.
  const gate = await requireApiPermission("exports:school");
  if (gate instanceof NextResponse) return gate;
  const ctx = gate;

  const rows = await listSchoolCertificates(ctx);

  const body = toCsvBody([
    ["student_name", "certificate", "kind", "serial", "issued_date", "status"],
    ...rows.map((r) => [
      r.studentName,
      resolveText(r.title, ctx.locale),
      r.kind,
      r.serial,
      r.issuedAt.slice(0, 10),
      r.revokedAt ? "revoked" : "valid",
    ]),
  ]);

  await audit({
    action: "exports.certificates_issued",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId: ctx.schoolId,
    targetType: "report",
    targetId: "certificates_issued",
    meta: { rowCount: rows.length },
  });

  return new NextResponse(body, {
    status: 200,
    headers: csvHeaders("school-certificates-issued.csv"),
  });
}
