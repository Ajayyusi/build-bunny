import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import {
  getSchoolSummary,
  listClasses,
  listTeachers,
} from "@/modules/schools/server/queries";
import {
  Badge,
  DataTable,
  ErrorState,
  PageHeader,
  StatCard,
  type DataTableColumn,
} from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

// Read-only in M1 — school management actions arrive in M4, so there are no
// action buttons here yet.
export default async function SchoolPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SCHOOL_ADMIN");
  const [summary, teachers, classes, t] = await Promise.all([
    getSchoolSummary(ctx),
    listTeachers(ctx),
    listClasses(ctx),
    getTranslations("staff.school"),
  ]);

  if (!summary) {
    return (
      <ErrorState
        title={t("missingTitle")}
        description={t("missingBody")}
        className="my-8"
      />
    );
  }

  type TeacherRow = (typeof teachers)[number];
  type ClassRow = (typeof classes)[number];

  const teacherColumns: DataTableColumn<TeacherRow>[] = [
    {
      key: "name",
      header: t("name"),
      cell: (row) => <span className="font-medium">{row.displayName}</span>,
    },
    { key: "email", header: t("email"), cell: (row) => row.email },
    {
      key: "status",
      header: t("status"),
      cell: (row) =>
        row.banned ? (
          <Badge variant="danger">{t("statusDisabled")}</Badge>
        ) : (
          <Badge variant="positive">{t("statusActive")}</Badge>
        ),
    },
  ];

  const classColumns: DataTableColumn<ClassRow>[] = [
    {
      key: "name",
      header: t("name"),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "grade",
      header: t("grade"),
      cell: (row) => <span className="tabular-nums">{row.grade}</span>,
      align: "end",
    },
    {
      key: "year",
      header: t("year"),
      // Year ranges like "2026–2027" are direction-neutral and would visually
      // reverse in RTL; isolate them as LTR.
      cell: (row) => <span dir="ltr">{row.academicYear.name}</span>,
    },
    {
      key: "students",
      header: t("classStudents"),
      cell: (row) => (
        <span className="tabular-nums">{row._count.memberships}</span>
      ),
      align: "end",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={summary.name} description={t("subtitle")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("teachers")} value={summary.counts.teachers} />
        <StatCard label={t("students")} value={summary.counts.students} />
        <StatCard label={t("classes")} value={summary.counts.classes} />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("teachers")}</h2>
        <DataTable
          columns={teacherColumns}
          rows={teachers}
          rowKey={(row) => row.id}
          emptyMessage={t("noTeachers")}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("classes")}</h2>
        <DataTable
          columns={classColumns}
          rows={classes}
          rowKey={(row) => row.id}
          emptyMessage={t("noClasses")}
        />
      </section>
    </div>
  );
}
