import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { hasPermission } from "@/modules/auth/permissions";
import { requireRole } from "@/modules/auth/server/session";
import { getClassMatrix } from "@/modules/analytics/server/queries";
import {
  listAssignableContent,
  listClassAssignments,
} from "@/modules/assignments/server/queries";
import { Button, ErrorState, PageHeader, StatCard, cn } from "@/ui";

import { AssignmentsManager, type AssignmentRowVM } from "../../_components/AssignmentsManager";
import { MatrixLegend, ProgressMatrix } from "./_components/ProgressMatrix";

interface Props {
  params: Promise<{ locale: string; classId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ClassPage({ params, searchParams }: Props) {
  const { locale, classId } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [matrix, t, tCommon] = await Promise.all([
    getClassMatrix(ctx, classId),
    getTranslations("staff.teach.matrix"),
    getTranslations("common"),
  ]);

  if (!matrix) {
    return (
      <ErrorState
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        className="my-8"
      />
    );
  }

  const activeTab = tab === "assignments" ? "assignments" : "matrix";
  const tabClass = (active: boolean) =>
    cn(
      "inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors",
      active ? "bg-brand/10 text-brand" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={matrix.className}
        description={tCommon("grade", { grade: String(matrix.grade) })}
        actions={
          <Link href={`/teach/classes/${classId}/live`}>
            <Button variant="secondary">
              <span aria-hidden="true">📽️</span>
              {t("liveLink")}
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("summary.students")} value={matrix.summary.studentCount} />
        <StatCard label={t("summary.completion")} value={`${matrix.summary.completionPct}%`} />
        <StatCard label={t("summary.avgStars")} value={matrix.summary.avgStars} />
        <StatCard label={t("summary.activeThisWeek")} value={matrix.summary.activeThisWeek} />
      </div>

      <nav
        aria-label={t("assignmentsLink")}
        className="flex flex-wrap items-center gap-1 border-b border-border-token pb-1"
      >
        <Link
          href={`/teach/classes/${classId}`}
          aria-current={activeTab === "matrix" ? "page" : undefined}
          className={tabClass(activeTab === "matrix")}
        >
          {t("tabLabel")}
        </Link>
        <Link
          href={`/teach/classes/${classId}?tab=assignments`}
          aria-current={activeTab === "assignments" ? "page" : undefined}
          className={tabClass(activeTab === "assignments")}
        >
          {t("assignmentsLink")}
        </Link>
      </nav>

      {activeTab === "matrix" ? (
        <div className="flex flex-col gap-4">
          <MatrixLegend />
          <ProgressMatrix matrix={matrix} classId={classId} locale={locale} />
        </div>
      ) : (
        <ClassAssignmentsTab ctx={ctx} classId={classId} className={matrix.className} grade={matrix.grade} />
      )}
    </div>
  );
}

async function ClassAssignmentsTab({
  ctx,
  classId,
  className,
  grade,
}: {
  ctx: Awaited<ReturnType<typeof requireRole>>;
  classId: string;
  className: string;
  grade: number;
}) {
  const [assignments, content] = await Promise.all([
    listClassAssignments(ctx, classId),
    listAssignableContent(ctx),
  ]);
  const rows: AssignmentRowVM[] = assignments.map((a) => ({
    id: a.id,
    classId: a.classId,
    className: a.className,
    target: a.target,
    targetLabel: a.targetLabel,
    title: a.title,
    note: a.note,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    closedAt: a.closedAt ? a.closedAt.toISOString() : null,
    createdByName: a.createdByName,
  }));

  return (
    <AssignmentsManager
      assignments={rows}
      classes={[{ id: classId, name: className, grade }]}
      fixedClassId={classId}
      worlds={content.worlds}
      canManage={hasPermission(ctx.role, "assignments:manage")}
    />
  );
}
