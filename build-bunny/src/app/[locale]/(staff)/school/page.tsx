import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { getSchoolSummary } from "@/modules/schools/server/queries";
import { getSchoolAnalytics, type SchoolAnalyticsLevel } from "@/modules/analytics/server/school";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  BarList,
  Card,
  CardBody,
  CardTitle,
  DataTable,
  ErrorState,
  PageHeader,
  StatCard,
  type DataTableColumn,
} from "@/ui";

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
  const [summary, analytics, t, tNav, tAnalytics, tCommon] = await Promise.all([
    getSchoolSummary(ctx),
    getSchoolAnalytics(ctx),
    getTranslations("staff.school"),
    getTranslations("staff.school.nav"),
    getTranslations("staff.school.analytics"),
    getTranslations("common"),
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

  const byGradeItems = (analytics?.byGrade ?? []).map((g) => ({
    key: String(g.grade),
    label: tCommon("grade", { grade: g.grade }),
    value: g.completionPct,
    valueLabel: `${g.completionPct}%`,
  }));

  const classColumns: DataTableColumn<NonNullable<typeof analytics>["byClass"][number]>[] = [
    {
      key: "className",
      header: tAnalytics("columnClass"),
      cell: (row) => <span className="font-medium">{row.className}</span>,
    },
    {
      key: "grade",
      header: tAnalytics("columnGrade"),
      cell: (row) => tCommon("grade", { grade: row.grade }),
    },
    {
      key: "students",
      header: tAnalytics("columnStudents"),
      cell: (row) => <span className="tabular-nums">{row.studentCount}</span>,
      align: "end",
    },
    {
      key: "completion",
      header: tAnalytics("columnCompletion"),
      cell: (row) => <span className="tabular-nums">{row.completionPct}%</span>,
      align: "end",
    },
    {
      key: "avgStars",
      header: tAnalytics("columnAvgStars"),
      cell: (row) => <span className="tabular-nums">{row.avgStars}</span>,
      align: "end",
    },
    {
      key: "activeWeek",
      header: tAnalytics("columnActiveWeek"),
      cell: (row) => <span className="tabular-nums">{row.activeThisWeek}</span>,
      align: "end",
    },
  ];

  function levelColumns(showFailRate: boolean): DataTableColumn<SchoolAnalyticsLevel>[] {
    const columns: DataTableColumn<SchoolAnalyticsLevel>[] = [
      {
        key: "level",
        header: tAnalytics("columnLevel"),
        cell: (row) => <span className="font-medium">{resolveText(row.title, locale)}</span>,
      },
      { key: "world", header: tAnalytics("columnWorld"), cell: (row) => resolveText(row.worldName, locale) },
      {
        key: "attempts",
        header: tAnalytics("columnAttempts"),
        cell: (row) => <span className="tabular-nums">{row.attempts}</span>,
        align: "end",
      },
    ];
    if (showFailRate) {
      columns.push({
        key: "failRate",
        header: tAnalytics("columnFailRate"),
        cell: (row) => <span className="tabular-nums">{row.failRatePct}%</span>,
        align: "end",
      });
    }
    return columns;
  }

  const licenceSeatsValue =
    analytics && analytics.licenceSeatsTotal !== null
      ? tAnalytics("licenceSeatsValue", { used: analytics.licenceSeatsUsed, total: analytics.licenceSeatsTotal })
      : tAnalytics("licenceSeatsNoLicence", { used: analytics?.licenceSeatsUsed ?? summary.counts.students });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={summary.name} description={t("subtitle")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("teachers")} value={summary.counts.teachers} />
        <StatCard label={t("students")} value={summary.counts.students} />
        <StatCard label={t("classes")} value={summary.counts.classes} />
      </div>

      {analytics ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{tAnalytics("heading")}</h2>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label={tAnalytics("activeWeek")} value={analytics.activeStudentsThisWeek} />
            <StatCard label={tAnalytics("activeMonth")} value={analytics.activeStudentsThisMonth} />
            <StatCard label={tAnalytics("avgStars")} value={analytics.avgStarsAcrossCompletions} />
            <StatCard label={tAnalytics("certificatesIssued")} value={analytics.certificatesIssued} />
            <StatCard label={tAnalytics("licenceSeats")} value={licenceSeatsValue} />
          </div>

          <Card>
            <CardBody className="flex flex-col gap-3">
              <CardTitle>{tAnalytics("byGradeHeading")}</CardTitle>
              {byGradeItems.length > 0 ? (
                <BarList items={byGradeItems} />
              ) : (
                <p className="text-sm text-ink-muted">{tAnalytics("byGradeEmpty")}</p>
              )}
            </CardBody>
          </Card>

          <div className="flex flex-col gap-2">
            <h3 className="font-display text-base font-semibold">{tAnalytics("byClassHeading")}</h3>
            <DataTable
              columns={classColumns}
              rows={analytics.byClass}
              rowKey={(row) => row.classId}
              emptyMessage={tAnalytics("byClassEmpty")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-base font-semibold">{tAnalytics("mostAttemptedHeading")}</h3>
              <DataTable
                columns={levelColumns(false)}
                rows={analytics.mostAttemptedLevels}
                rowKey={(row) => row.levelId}
                emptyMessage={tAnalytics("levelsEmpty")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-base font-semibold">{tAnalytics("mostFailedHeading")}</h3>
              <DataTable
                columns={levelColumns(true)}
                rows={analytics.mostFailedLevels}
                rowKey={(row) => row.levelId}
                emptyMessage={tAnalytics("levelsEmpty")}
              />
            </div>
          </div>
        </section>
      ) : null}

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
