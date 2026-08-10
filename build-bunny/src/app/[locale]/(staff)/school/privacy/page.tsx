import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { Button, Card, CardBody, CardHeader, CardTitle, PageHeader } from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * School data export + a pointer to student erasure (m5 §35 / plan §35 —
 * the "school trust pack" the critique recommended). Erasure itself stays on
 * the Students page next to the affected row (per-student action, typed
 * confirmation) rather than being duplicated here; this page only links to
 * it so the destructive action has exactly one home.
 */
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SCHOOL_ADMIN");
  const t = await getTranslations("staff.school.privacyPage");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("exportHeading")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col items-start gap-3">
          <p className="text-sm text-ink-muted">{t("exportBody")}</p>
          {/* next/link, not the locale-aware @/i18n/navigation one — API
              routes are excluded from locale prefixing (src/middleware.ts). */}
          <div className="flex flex-wrap gap-2">
            <NextLink href="/api/school/privacy/export?format=json">
              <Button>{t("downloadJsonCta")}</Button>
            </NextLink>
            <NextLink href="/api/school/privacy/export?format=csv">
              <Button variant="secondary">{t("downloadCsvCta")}</Button>
            </NextLink>
          </div>
          <p className="text-xs text-ink-muted">{t("exportedNote")}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("eraseHeading")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col items-start gap-3">
          <p className="text-sm text-ink-muted">{t("eraseBody")}</p>
          <Link href="/school/students">
            <Button variant="secondary">{t("eraseLinkCta")}</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
