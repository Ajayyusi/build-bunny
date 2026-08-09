import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import {
  listAcademicYears,
  listClasses,
  listStudents,
  listTeachers,
} from "@/modules/schools/server/queries";
import { PageHeader } from "@/ui";

import { ClassesManager } from "./ClassesManager";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ClassesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SCHOOL_ADMIN");
  const [classes, academicYears, teachers, students, t] = await Promise.all([
    listClasses(ctx),
    listAcademicYears(ctx),
    listTeachers(ctx),
    listStudents(ctx),
    getTranslations("staff.school.classesPage"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ClassesManager
        classes={classes}
        academicYears={academicYears.map((y) => ({ id: y.id, name: y.name }))}
        teachers={teachers.map((tch) => ({ id: tch.id, displayName: tch.displayName }))}
        students={students.map((s) => ({
          id: s.id,
          displayName: s.displayName,
          displayUsername: s.displayUsername,
        }))}
      />
    </div>
  );
}
