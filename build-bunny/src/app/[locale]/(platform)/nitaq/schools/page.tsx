import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { listSchools } from "@/modules/schools/server/platform-queries";
import { PageHeader } from "@/ui";

import { SchoolsManager } from "./SchoolsManager";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function NitaqSchoolsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const [schools, t] = await Promise.all([
    listSchools(ctx),
    getTranslations("platform.schools"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SchoolsManager schools={schools} />
    </div>
  );
}
