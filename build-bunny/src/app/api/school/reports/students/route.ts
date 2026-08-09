import { NextResponse } from "next/server";

import { hasPermission } from "@/modules/auth/permissions";
import { getSessionContext } from "@/modules/auth/server/session";
import { getSchoolProgressReport } from "@/modules/schools/server/queries";

/**
 * GET /api/school/reports/students — CSV export of class/student progress
 * (plan §1.2). Streams a plain CSV (no server PDF/xlsx dependency) with
 * formula-injection neutralized: any cell starting with = + - @ gets a
 * leading apostrophe so a spreadsheet app never executes it as a formula.
 */

function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function toCsvRow(cells: (string | number)[]): string {
  return cells.map((c) => csvCell(String(c))).join(",");
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!hasPermission(ctx.role, "exports:school")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

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
