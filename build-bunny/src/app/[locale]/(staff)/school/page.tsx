import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { getSchoolSummary } from "@/modules/schools/server/queries";
import { Card, CardBody, ErrorState, PageHeader, StatCard } from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

const SECTIONS = [
  { href: "/school/teachers", navKey: "teachers", icon: "🧑‍🏫" },
  { href: "/school/students", navKey: "students", icon: "🎒" },
  { href: "/school/classes", navKey: "classes", icon: "🏫" },
  { href: "/school/imports", navKey: "imports", icon: "📥" },
  { href: "/school/certificates", navKey: "certificates", icon: "🏅" },
  { href: "/school/reports", navKey: "reports", icon: "📊" },
] as const;

export default async function SchoolPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SCHOOL_ADMIN");
  const [summary, t, tNav] = await Promise.all([
    getSchoolSummary(ctx),
    getTranslations("staff.school"),
    getTranslations("staff.school.nav"),
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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={summary.name} description={t("subtitle")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("teachers")} value={summary.counts.teachers} />
        <StatCard label={t("students")} value={summary.counts.students} />
        <StatCard label={t("classes")} value={summary.counts.classes} />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("manageHeading")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="transition-colors hover:bg-surface-sunken">
                <CardBody className="flex items-center gap-3">
                  <span aria-hidden className="text-2xl">
                    {section.icon}
                  </span>
                  <span className="font-display font-semibold text-ink">
                    {tNav(section.navKey)}
                  </span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
