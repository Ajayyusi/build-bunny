import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { Button, Card, CardBody, CardTitle, PageHeader } from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

interface ReportCard {
  titleKey: string;
  hintKey: string;
  ctaKey: string;
  href: string;
}

// M5 analytics & reports §4: four streamed CSV exports, all gated by the
// same exports:school permission and all formula-injection neutralized
// (see @/lib/csv). students/route.ts predates this milestone; the other
// three reuse getSchoolAnalytics / listSchoolCertificates.
const REPORTS: ReportCard[] = [
  {
    titleKey: "studentProgressTitle",
    hintKey: "downloadHint",
    ctaKey: "downloadCta",
    href: "/api/school/reports/students",
  },
  {
    titleKey: "classProgressTitle",
    hintKey: "classProgressHint",
    ctaKey: "classProgressCta",
    href: "/api/school/reports/classes",
  },
  {
    titleKey: "gradeProgressTitle",
    hintKey: "gradeProgressHint",
    ctaKey: "gradeProgressCta",
    href: "/api/school/reports/grades",
  },
  {
    titleKey: "certificatesTitle",
    hintKey: "certificatesHint",
    ctaKey: "certificatesCta",
    href: "/api/school/reports/certificates",
  },
];

export default async function ReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SCHOOL_ADMIN");
  const t = await getTranslations("staff.school.reportsPage");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Card key={report.href}>
            <CardBody className="flex flex-col items-start gap-3">
              <CardTitle>{t(report.titleKey)}</CardTitle>
              <p className="text-sm text-ink-muted">{t(report.hintKey)}</p>
              {/* next/link, not the locale-aware @/i18n/navigation one — API
                  routes are excluded from locale prefixing (src/middleware.ts). */}
              <NextLink href={report.href}>
                <Button>{t(report.ctaKey)}</Button>
              </NextLink>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
