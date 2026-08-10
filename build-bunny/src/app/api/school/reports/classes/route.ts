import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { csvHeaders, toCsvBody } from "@/lib/csv";
import { hasPermission } from "@/modules/auth/permissions";
import { getSessionContext } from "@/modules/auth/server/session";
import { getSchoolAnalytics } from "@/modules/analytics/server/school";

/**
 * GET /api/school/reports/classes — CSV export of the per-class comparison
 * (M5 analytics & reports §4), same shape shown on /school. Reuses
 * getSchoolAnalytics rather than re-querying — one tenant-scoped read backs
 * both the dashboard and this export. Formula-injection neutralized via
 * @/lib/csv (see src/app/api/school/reports/students/route.ts for the
 * original pattern this follows).
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
  const rows = analytics?.byClass ?? [];

  const body = toCsvBody([
    ["class_name", "grade", "students", "completion_pct", "avg_stars", "active_this_week"],
    ...rows.map((r) => [r.className, r.grade, r.studentCount, r.completionPct, r.avgStars, r.activeThisWeek]),
  ]);

  await audit({
    action: "exports.class_progress",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId: ctx.schoolId,
    targetType: "report",
    targetId: "class_progress",
    meta: { rowCount: rows.length },
  });

  return new NextResponse(body, {
    status: 200,
    headers: csvHeaders("school-class-progress.csv"),
  });
}
