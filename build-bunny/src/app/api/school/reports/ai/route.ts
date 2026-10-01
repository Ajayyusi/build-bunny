import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { csvHeaders, toCsvBody } from "@/lib/csv";
import { AI_CONCEPTS } from "@/modules/analytics/ai-concepts";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
import { getSchoolAnalytics } from "@/modules/analytics/server/school";

/**
 * GET /api/school/reports/ai — CSV of AI activity (last 30 days) and AI
 * concept mastery (secure / students) per class, the same numbers /school
 * shows. Class totals only; same gate and formula-injection guard as the
 * other school exports.
 */
export async function GET() {
  const gate = await requireApiPermission("exports:school");
  if (gate instanceof NextResponse) return gate;
  const ctx = gate;

  const analytics = await getSchoolAnalytics(ctx);
  const activity = new Map((analytics?.aiActivity ?? []).map((row) => [row.classId, row]));
  const rows = analytics?.aiConceptsByClass ?? [];

  const body = toCsvBody([
    [
      "class_name",
      "students",
      "sessions_30d",
      "tests_30d",
      "retries_30d",
      "completions_30d",
      "returned_another_day_30d",
      ...AI_CONCEPTS.map((c) => `secure_${c}`),
      ...AI_CONCEPTS.map((c) => `secure_${c}_4_weeks_ago`),
    ],
    ...rows.map((row) => {
      const a = activity.get(row.classId);
      return [
        row.className,
        a?.studentCount ?? 0,
        a?.starts ?? 0,
        a?.tests ?? 0,
        a?.retries ?? 0,
        a?.completions ?? 0,
        a?.returned ?? 0,
        ...AI_CONCEPTS.map((c) => (row.concepts[c].levels > 0 ? `${row.concepts[c].secure}/${row.concepts[c].students}` : "")),
        ...AI_CONCEPTS.map((c) => (row.concepts[c].levels > 0 ? row.secureBefore[c] : "")),
      ];
    }),
  ]);

  await audit({
    action: "exports.ai_activity",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId: ctx.schoolId,
    targetType: "report",
    targetId: "ai_activity",
    meta: { rowCount: rows.length },
  });

  return new NextResponse(body, { status: 200, headers: csvHeaders("school-ai-activity.csv") });
}
