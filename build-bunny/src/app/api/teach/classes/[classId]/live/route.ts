import { NextResponse } from "next/server";

import { getSessionContext } from "@/modules/auth/server/session";
import { getClassMatrix } from "@/modules/analytics/server/queries";
import { resolveText } from "@/modules/curriculum/schemas";

/**
 * GET /api/teach/classes/[classId]/live — polled every 20s by the projector
 * view (m4 deliverable 7). Read-only, no student PII beyond display names.
 * Reuses the real matrix query — never fake data. Locale comes from the
 * client's own query string since this route has no next-intl request
 * context of its own.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const ctx = await getSessionContext();
  if (!ctx || (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN")) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { classId } = await params;
  const locale = new URL(request.url).searchParams.get("locale") === "ar" ? "ar" : "en";

  const matrix = await getClassMatrix(ctx, classId);
  if (!matrix) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const students = matrix.students.map((student) => {
    let currentLevelTitle: string | null = null;
    let completed = matrix.levels.length > 0;
    for (const level of matrix.levels) {
      const cell = student.cells[level.id];
      const status = cell?.status ?? "LOCKED";
      if (status !== "COMPLETED") completed = false;
      if ((status === "IN_PROGRESS" || status === "UNLOCKED") && currentLevelTitle === null) {
        currentLevelTitle = resolveText(level.title, locale);
      }
    }
    return { userId: student.userId, displayName: student.displayName, currentLevelTitle, completed };
  });

  return NextResponse.json({
    className: matrix.className,
    grade: matrix.grade,
    completionPct: matrix.summary.completionPct,
    activeThisWeek: matrix.summary.activeThisWeek,
    studentCount: matrix.summary.studentCount,
    students,
  });
}
