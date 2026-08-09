import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { PageHeader } from "@/ui";

import { ImportWizard } from "./ImportWizard";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CurriculumImportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const t = await getTranslations("platform.curriculum.import");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link
            href="/nitaq/curriculum"
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
