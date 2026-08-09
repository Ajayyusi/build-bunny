import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { listTeachers } from "@/modules/schools/server/queries";
import { PageHeader } from "@/ui";

import { TeachersManager } from "./TeachersManager";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function TeachersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SCHOOL_ADMIN");
  const [teachers, t] = await Promise.all([
    listTeachers(ctx),
    getTranslations("staff.school.teachersPage"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <TeachersManager teachers={teachers} />
    </div>
  );
}
