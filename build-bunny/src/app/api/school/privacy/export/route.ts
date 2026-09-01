import { NextResponse, type NextRequest } from "next/server";

import { audit, AUDIT } from "@/lib/audit";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
import { getSchoolDataExport } from "@/modules/schools/server/queries";

/**
 * GET /api/school/privacy/export?format=json|csv — the school data export
 * half of m5 §35's erasure-and-export pair (the erasure half is
 * eraseStudentAction, src/app/[locale]/(staff)/school/students/actions.ts).
 * Behind SCHOOL_ADMIN (exports:school, same permission the progress-report
 * CSV already uses) and fully audited — every download is logged with the
 * format and row counts, same as the CSV export in
 * /api/school/reports/students already established the pattern for.
 *
 * "JSON + CSV bundle" (plan §35 / m5 §4b) ships as one query, two formats,
 * rather than a hand-rolled .zip: this app already has a precedent for
 * avoiding a heavy new dependency for a file-format nicety (certificates'
 * hand-rolled QR encoder over a barcode library), and a real ZIP writer is
 * an order of magnitude more code/attack-surface than this warrants for two
 * small files a school admin downloads rarely. The CSV format bundles every
 * table into one file with `### SECTION` marker rows (documented in
 * docs/privacy-data-inventory.md) instead of one .csv per table.
 */

function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function row(cells: (string | number | boolean)[]): string {
  return cells.map((c) => csvCell(String(c))).join(",");
}

function toCsvBundle(data: Awaited<ReturnType<typeof getSchoolDataExport>>): string {
  const lines: string[] = [];
  lines.push(row(["Build Bunny school data export"]));
  lines.push(row(["exported_at", data.exportedAt]));
  lines.push("");

  lines.push(row(["### SCHOOL"]));
  lines.push(row(["id", "name", "code", "slug", "status", "timezone"]));
  lines.push(
    row([data.school.id, data.school.name, data.school.code, data.school.slug, data.school.status, data.school.timezone]),
  );
  lines.push("");

  lines.push(row(["### TEACHERS"]));
  lines.push(row(["id", "display_name", "email", "title", "disabled", "created_at"]));
  for (const t of data.teachers) {
    lines.push(row([t.id, t.displayName, t.email, t.title ?? "", Boolean(t.banned), t.createdAt]));
  }
  lines.push("");

  lines.push(row(["### STUDENTS"]));
  lines.push(
    row([
      "id",
      "display_name",
      "username",
      "student_identifier",
      "grade",
      "classes",
      "xp_total",
      "stars_total",
      "streak_current",
      "streak_best",
      "last_active_date",
      "disabled",
      "created_at",
    ]),
  );
  for (const s of data.students) {
    lines.push(
      row([
        s.id,
        s.displayName,
        s.username ?? "",
        s.studentIdentifier,
        s.grade,
        s.classNames.join("; "),
        s.xpTotal,
        s.starsTotal,
        s.streakCurrent,
        s.streakBest,
        s.lastActiveDate ?? "",
        Boolean(s.banned),
        s.createdAt,
      ]),
    );
  }
  lines.push("");

  lines.push(row(["### CLASSES"]));
  lines.push(row(["id", "name", "grade", "academic_year", "student_count"]));
  for (const c of data.classes) {
    lines.push(row([c.id, c.name, c.grade, c.academicYear, c.studentCount]));
  }
  lines.push("");

  lines.push(row(["### CERTIFICATES"]));
  lines.push(row(["serial", "kind", "student_name", "issued_at", "revoked"]));
  for (const c of data.certificates) {
    lines.push(row([c.serial, c.kind, c.studentName, c.issuedAt, c.revoked]));
  }

  return lines.join("\r\n") + "\r\n";
}

export async function GET(request: NextRequest) {
  // Shared guard: role AND licence entitlement (see api-guard). The extra
  // schoolId check stays — a platform admin holds the permission but has no
  // school of their own to export.
  const gate = await requireApiPermission("exports:school");
  if (gate instanceof NextResponse) return gate;
  const ctx = gate;
  if (!ctx.schoolId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const data = await getSchoolDataExport(ctx);

  await audit({
    action: AUDIT.privacy.dataExported,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId: ctx.schoolId,
    targetType: "school",
    targetId: ctx.schoolId,
    meta: {
      format,
      teachers: data.teachers.length,
      students: data.students.length,
      classes: data.classes.length,
      certificates: data.certificates.length,
    },
  });

  if (format === "csv") {
    return new NextResponse(toCsvBundle(data), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${data.school.code}-data-export.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.school.code}-data-export.json"`,
    },
  });
}
