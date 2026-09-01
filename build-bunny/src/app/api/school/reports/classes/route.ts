import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { csvHeaders, toCsvBody } from "@/lib/csv";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
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
  // Shared guard: role AND licence entitlement, the same rule server actions
  // run under. Hand-rolling it here skipped the licence check entirely, so a
  // suspended school could still export its roster.
  const gate = await requireApiPermission("exports:school");
  if (gate instanceof NextResponse) return gate;
  const ctx = gate;

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
