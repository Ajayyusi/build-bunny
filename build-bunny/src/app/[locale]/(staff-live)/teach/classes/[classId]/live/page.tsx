import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { getClassMatrix } from "@/modules/analytics/server/queries";
import { resolveText } from "@/modules/curriculum/schemas";
import { ErrorState } from "@/ui";

import { LiveView, type LiveSnapshot } from "./_components/LiveView";

interface Props {
  params: Promise<{ locale: string; classId: string }>;
}

export default async function ClassLivePage({ params }: Props) {
  const { locale, classId } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [matrix, t] = await Promise.all([
    getClassMatrix(ctx, classId),
    getTranslations("staff.teach.matrix"),
  ]);

  if (!matrix) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <ErrorState title={t("notFoundTitle")} description={t("notFoundBody")} />
      </div>
    );
  }

  const initial: LiveSnapshot = {
    className: matrix.className,
    grade: matrix.grade,
    completionPct: matrix.summary.completionPct,
    activeThisWeek: matrix.summary.activeThisWeek,
    studentCount: matrix.summary.studentCount,
    students: matrix.students.map((student) => {
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
    }),
  };

  return <LiveView classId={classId} locale={locale} initial={initial} />;
}
