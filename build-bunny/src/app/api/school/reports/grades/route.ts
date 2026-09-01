import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { csvHeaders, toCsvBody } from "@/lib/csv";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
import { getSchoolAnalytics } from "@/modules/analytics/server/school";

/**
 * GET /api/school/reports/grades — CSV export of school progress by grade
 * (M5 analytics & reports §4). Same source read as /api/school/reports/classes
 * — see that file's comment for the shared-read rationale and the
 * formula-injection pattern in @/lib/csv.
 */
export async function GET() {
  // Shared guard: role AND licence entitlement, the same rule server actions
  // run under. Hand-rolling it here skipped the licence check entirely, so a
  // suspended school could still export its roster.
  const gate = await requireApiPermission("exports:school");
  if (gate instanceof NextResponse) return gate;
  const ctx = gate;

  const analytics = await getSchoolAnalytics(ctx);
  const rows = analytics?.byGrade ?? [];

  const body = toCsvBody([
    ["grade", "students", "completion_pct", "avg_stars"],
    ...rows.map((r) => [r.grade, r.studentCount, r.completionPct, r.avgStars]),
  ]);

  await audit({
    action: "exports.grade_progress",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId: ctx.schoolId,
    targetType: "report",
    targetId: "grade_progress",
    meta: { rowCount: rows.length },
  });

  return new NextResponse(body, {
    status: 200,
    headers: csvHeaders("school-progress-by-grade.csv"),
  });
}
