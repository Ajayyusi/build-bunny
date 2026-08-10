import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { csvHeaders, toCsvBody } from "@/lib/csv";
import { hasPermission } from "@/modules/auth/permissions";
import { getSessionContext } from "@/modules/auth/server/session";
import { getSchoolAnalytics } from "@/modules/analytics/server/school";

/**
 * GET /api/school/reports/grades — CSV export of school progress by grade
 * (M5 analytics & reports §4). Same source read as /api/school/reports/classes
 * — see that file's comment for the shared-read rationale and the
 * formula-injection pattern in @/lib/csv.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!hasPermission(ctx.role, "exports:school")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

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
