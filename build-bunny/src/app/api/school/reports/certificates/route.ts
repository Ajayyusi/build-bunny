import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { csvHeaders, toCsvBody } from "@/lib/csv";
import { hasPermission } from "@/modules/auth/permissions";
import { getSessionContext } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import { listSchoolCertificates } from "@/modules/certificates/server/queries";

/**
 * GET /api/school/reports/certificates — CSV export of every certificate
 * issued to this school's students (M5 analytics & reports §4). Reuses the
 * existing tenant-scoped listSchoolCertificates (m4) rather than adding a
 * new query. Formula-injection neutralized via @/lib/csv.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!hasPermission(ctx.role, "exports:school")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

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
