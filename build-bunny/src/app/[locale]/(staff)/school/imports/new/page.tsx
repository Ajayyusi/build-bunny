import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { PageHeader } from "@/ui";

import { ImportWizard } from "./ImportWizard";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function NewImportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SCHOOL_ADMIN");
  const t = await getTranslations("staff.school.importsPage.wizard");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        actions={
          <Link
            href="/school/imports"
            className="inline-flex h-10 items-center rounded-md border border-border-token bg-surface-raised px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken"
          >
            {t("backLink")}
          </Link>
        }
      />
      <ImportWizard />
    </div>
  );
}
