import { getTranslations, setRequestLocale } from "next-intl/server";

import { hasPermission } from "@/modules/auth/permissions";
import { requireRole } from "@/modules/auth/server/session";
import {
  listAssignableContent,
  listMyAssignments,
} from "@/modules/assignments/server/queries";
import { listMyClasses } from "@/modules/schools/server/queries";
import { PageHeader } from "@/ui";

import { AssignmentsManager, type AssignmentRowVM } from "../_components/AssignmentsManager";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AssignmentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER");
  const [assignments, classes, content, t] = await Promise.all([
    listMyAssignments(ctx),
    listMyClasses(ctx),
    listAssignableContent(ctx),
    getTranslations("staff.teach.assignments"),
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
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <AssignmentsManager
        assignments={rows}
        classes={classes.map((c) => ({ id: c.id, name: c.name, grade: c.grade }))}
        worlds={content.worlds}
        canManage={hasPermission(ctx.role, "assignments:manage")}
      />
    </div>
  );
}
