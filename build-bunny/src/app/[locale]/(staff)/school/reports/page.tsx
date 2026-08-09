import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { Button, Card, CardBody, PageHeader } from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SCHOOL_ADMIN");
  const t = await getTranslations("staff.school.reportsPage");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <CardBody className="flex flex-col items-start gap-3">
          <p className="text-sm text-ink-muted">{t("downloadHint")}</p>
          {/* next/link, not the locale-aware @/i18n/navigation one — API
              routes are excluded from locale prefixing (src/middleware.ts). */}
          <NextLink href="/api/school/reports/students">
            <Button>{t("downloadCta")}</Button>
          </NextLink>
        </CardBody>
      </Card>
    </div>
  );
}
