import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { getSchoolSummary, listClasses, listStudents } from "@/modules/schools/server/queries";
import { Field, Input, PageHeader, Select } from "@/ui";

import { StudentsManager } from "./StudentsManager";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function StudentsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SCHOOL_ADMIN");
  const sp = await searchParams;

  const search = asString(sp.q);
  const classId = asString(sp.classId);
  const gradeRaw = asString(sp.grade);
  const grade = gradeRaw !== "" ? Number(gradeRaw) : undefined;
  const statusRaw = asString(sp.status);
  const status = statusRaw === "active" || statusRaw === "disabled" ? statusRaw : undefined;

  const [students, classes, summary, t] = await Promise.all([
    listStudents(ctx, {
      search: search || undefined,
      classId: classId || undefined,
      grade,
      status,
    }),
    listClasses(ctx),
    getSchoolSummary(ctx),
    getTranslations("staff.school.studentsPage"),
  ]);

  const grades = [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b);
  const activeClass = classes.find((c) => c.id === classId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <form method="get" className="grid gap-3 sm:grid-cols-4 print:hidden">
        <Field label={t("filterClass")} className="sm:col-span-2">
          <Input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={t("searchPlaceholder")}
          />
        </Field>
        <Field label={t("filterClass")}>
          <Select name="classId" defaultValue={classId}>
            <option value="">{t("allClasses")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("filterGrade")}>
          <Select name="grade" defaultValue={gradeRaw}>
            <option value="">{t("allGrades")}</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("filterStatus")}>
          <Select name="status" defaultValue={statusRaw}>
            <option value="">{t("allStatuses")}</option>
            <option value="active">{t("columnStatus")}</option>
            <option value="disabled">{t("columnStatus")}</option>
          </Select>
        </Field>
        <button type="submit" className="sr-only">
          {t("searchPlaceholder")}
        </button>
      </form>

      <StudentsManager
        students={students}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        schoolCode={summary?.code ?? ""}
        activeClassId={classId}
        activeClassName={activeClass?.name ?? ""}
      />
    </div>
  );
}
