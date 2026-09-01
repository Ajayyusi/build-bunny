import { NextResponse } from "next/server";

import { toCsvRow } from "@/lib/csv";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
import { getSchoolProgressReport } from "@/modules/schools/server/queries";

/**
 * GET /api/school/reports/students — CSV export of class/student progress
 * (plan §1.2). Streams a plain CSV (no server PDF/xlsx dependency) with
 * formula-injection neutralized: any cell starting with = + - @ gets a
 * leading apostrophe so a spreadsheet app never executes it as a formula.
 */

export async function GET() {
  // Shared guard: role AND licence entitlement, the same rule server actions
  // run under. Hand-rolling it here skipped the licence check entirely, so a
  // suspended school could still export its roster.
  const gate = await requireApiPermission("exports:school");
  if (gate instanceof NextResponse) return gate;
  const ctx = gate;

  const rows = await getSchoolProgressReport(ctx);

  const lines = [
    toCsvRow([
      "student_name",
      "username",
      "student_identifier",
      "class",
      "grade",
      "xp_total",
      "stars_total",
      "streak_current",
      "levels_completed",
      "last_active_date",
    ]),
    ...rows.map((r) =>
      toCsvRow([
        r.displayName,
        r.username ?? "",
        r.studentIdentifier,
        r.className ?? "",
        r.grade,
        r.xpTotal,
        r.starsTotal,
        r.streakCurrent,
        r.levelsCompleted,
        r.lastActiveDate ? r.lastActiveDate.toISOString().slice(0, 10) : "",
      ]),
    ),
  ];

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="school-progress-report.csv"',
    },
  });
}
