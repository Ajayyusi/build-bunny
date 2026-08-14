import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import {
  getPlatformOverview,
  listPlatformAuditLogs,
  listSchools,
} from "@/modules/schools/server/platform-queries";
import {
  getPlatformAnalytics,
  type PlatformFailedLevel,
  type PlatformLicenceExpiryEntry,
  type PlatformSchoolActivity,
} from "@/modules/analytics/server/platform";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  Badge,
  createDateFormat,
  DataTable,
  PageHeader,
  Sparkline,
  StatCard,
  type BadgeVariant,
  type DataTableColumn,
} from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

const LICENCE_BADGES: Record<string, BadgeVariant> = {
  ACTIVE: "positive",
  GRACE: "warning",
  READ_ONLY: "neutral",
  SUSPENDED: "danger",
};

const OUTCOME_BADGES: Record<string, BadgeVariant> = {
  SUCCESS: "positive",
  DENIED: "warning",
  ERROR: "danger",
};

const ROLE_KEYS = [
  "SUPER_ADMIN",
  "NITAQ_ADMIN",
  "SCHOOL_ADMIN",
  "TEACHER",
  "STUDENT",
  "SYSTEM",
] as const;

function isRoleKey(value: string): value is (typeof ROLE_KEYS)[number] {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

export default async function PlatformOverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const [overview, schools, auditLogs, analytics, t, tCommon] = await Promise.all([
    getPlatformOverview(ctx),
    listSchools(ctx),
    listPlatformAuditLogs(ctx, 20),
    getPlatformAnalytics(ctx),
    getTranslations("platform"),
    getTranslations("common"),
  ]);

  // -u-nu-latn keeps Western Arabic numerals in dates for both locales
  // (product-wide numeral policy).
  const dateFormat = createDateFormat(locale, {
    dateStyle: "medium",
  });
  const dateTimeFormat = createDateFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  type SchoolRow = (typeof schools)[number];
  type AuditRow = (typeof auditLogs)[number];

  const schoolColumns: DataTableColumn<SchoolRow>[] = [
    {
      key: "name",
      header: t("schools.name"),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "code",
      header: t("schools.code"),
      cell: (row) => (
        <code className="font-mono text-xs uppercase">{row.code}</code>
      ),
    },
    {
      key: "status",
      header: t("schools.status"),
      cell: (row) =>
        row.status === "ACTIVE" ? (
          <Badge variant="positive">{t("schools.statusActive")}</Badge>
        ) : (
          <Badge variant="neutral">{t("schools.statusInactive")}</Badge>
        ),
    },
    {
      key: "students",
      header: t("schools.students"),
      cell: (row) => (
        <span className="tabular-nums">{row._count.studentProfiles}</span>
      ),
      align: "end",
    },
    {
      key: "teachers",
      header: t("schools.teachers"),
      cell: (row) => (
        <span className="tabular-nums">{row._count.teacherProfiles}</span>
      ),
      align: "end",
    },
    {
      key: "licence",
      header: t("schools.licence"),
      cell: (row) => {
        const licence = row.licences[0];
        if (!licence) {
          return <Badge variant="neutral">{t("licence.none")}</Badge>;
        }
        return (
          <Badge variant={LICENCE_BADGES[licence.status] ?? "neutral"}>
            {t(`licence.${licence.status}`)}
          </Badge>
        );
      },
    },
    {
      key: "expiry",
      header: t("schools.expiry"),
      cell: (row) => {
        const licence = row.licences[0];
        return licence ? (
          <span className="tabular-nums">
            {dateFormat.format(licence.expiresAt)}
          </span>
        ) : (
          "—"
        );
      },
    },
  ];

  const auditColumns: DataTableColumn<AuditRow>[] = [
    {
      key: "time",
      header: t("audit.time"),
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {dateTimeFormat.format(row.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: t("audit.action"),
      cell: (row) => <code className="font-mono text-xs">{row.action}</code>,
    },
    {
      key: "actorRole",
      header: t("audit.actorRole"),
      cell: (row) =>
        row.actorRole && isRoleKey(row.actorRole)
          ? tCommon(`roles.${row.actorRole}`)
          : (row.actorRole ?? "—"),
    },
    {
      key: "outcome",
      header: t("audit.outcome"),
      cell: (row) => (
        <Badge variant={OUTCOME_BADGES[row.outcome] ?? "neutral"}>
          {t(`audit.${row.outcome}`)}
        </Badge>
      ),
    },
  ];

  const failedLevelColumns: DataTableColumn<PlatformFailedLevel>[] = [
    {
      key: "level",
      header: t("mostFailedLevels.columnLevel"),
      cell: (row) => <span className="font-medium">{resolveText(row.title, locale)}</span>,
    },
    { key: "world", header: t("mostFailedLevels.columnWorld"), cell: (row) => resolveText(row.worldName, locale) },
    {
      key: "attempts",
      header: t("mostFailedLevels.columnAttempts"),
      cell: (row) => <span className="tabular-nums">{row.attempts}</span>,
      align: "end",
    },
    {
      key: "failRate",
      header: t("mostFailedLevels.columnFailRate"),
      cell: (row) => <span className="tabular-nums">{row.failRatePct}%</span>,
      align: "end",
    },
  ];

  const schoolActivityColumns: DataTableColumn<PlatformSchoolActivity>[] = [
    {
      key: "school",
      header: t("schoolsByActivity.columnSchool"),
      cell: (row) => <span className="font-medium">{row.schoolName}</span>,
    },
    {
      key: "active",
      header: t("schoolsByActivity.columnActive"),
      cell: (row) => <span className="tabular-nums">{row.activeStudentsThisWeek}</span>,
      align: "end",
    },
    {
      key: "students",
      header: t("schoolsByActivity.columnStudents"),
      cell: (row) => <span className="tabular-nums">{row.totalStudents}</span>,
      align: "end",
    },
  ];

  const licencePipelineColumns: DataTableColumn<PlatformLicenceExpiryEntry>[] = [
    {
      key: "school",
      header: t("licencePipeline.columnSchool"),
      cell: (row) => <span className="font-medium">{row.schoolName}</span>,
    },
    {
      key: "status",
      header: t("licencePipeline.columnStatus"),
      cell: (row) => (
        <Badge variant={LICENCE_BADGES[row.status] ?? "neutral"}>{t(`licence.${row.status}`)}</Badge>
      ),
    },
    {
      key: "expires",
      header: t("licencePipeline.columnExpires"),
      cell: (row) => <span className="tabular-nums">{dateFormat.format(new Date(row.expiresAt))}</span>,
    },
    {
      key: "seats",
      header: t("licencePipeline.columnSeats"),
      cell: (row) => <span className="tabular-nums">{row.seats}</span>,
      align: "end",
    },
  ];

  const totalAttempts14d = analytics.attemptsPerDay14d.reduce((sum, p) => sum + p.attempts, 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("overviewTitle")}
        description={t("overviewSubtitle")}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t("stats.schools")} value={overview.schools} />
        <StatCard
          label={t("stats.activeSchools")}
          value={overview.activeSchools}
        />
        <StatCard label={t("stats.students")} value={overview.students} />
        <StatCard label={t("stats.teachers")} value={overview.teachers} />
        <StatCard
          label={t("stats.expiringLicences")}
          value={overview.licencesExpiringSoon}
          hint={t("stats.expiringHint")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("stats.dau")} value={analytics.dauStudents} />
        <StatCard label={t("stats.wau")} value={analytics.wauStudents} />
        <StatCard label={t("stats.certificatesIssued")} value={analytics.certificatesIssuedTotal} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("activity.heading")}</h2>
        {totalAttempts14d > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border-token bg-surface-raised p-5 shadow-soft">
            <Sparkline
              points={analytics.attemptsPerDay14d.map((p) => ({ label: p.date, value: p.attempts }))}
              ariaLabel={t("activity.ariaLabel")}
            />
            <p className="text-sm text-ink-muted">{t("activity.total", { count: totalAttempts14d })}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{t("activity.empty")}</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("mostFailedLevels.heading")}</h2>
            <p className="text-sm text-ink-muted">{t("mostFailedLevels.hint")}</p>
          </div>
          <DataTable
            columns={failedLevelColumns}
            rows={analytics.mostFailedLevels}
            rowKey={(row) => row.levelId}
            emptyMessage={t("mostFailedLevels.empty")}
          />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">{t("schoolsByActivity.heading")}</h2>
          <DataTable
            columns={schoolActivityColumns}
            rows={analytics.schoolsByActivity}
            rowKey={(row) => row.schoolId}
            emptyMessage={t("schoolsByActivity.empty")}
          />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("licencePipeline.heading")}</h2>
        <DataTable
          columns={licencePipelineColumns}
          rows={analytics.licenceExpiryPipeline}
          rowKey={(row) => `${row.schoolId}-${row.expiresAt}`}
          emptyMessage={t("licencePipeline.empty")}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">
          {t("schools.heading")}
        </h2>
        <DataTable
          columns={schoolColumns}
          rows={schools}
          rowKey={(row) => row.id}
          emptyMessage={t("schools.empty")}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">
          {t("audit.heading")}
        </h2>
        <DataTable
          columns={auditColumns}
          rows={auditLogs}
          rowKey={(row) => row.id}
          emptyMessage={t("audit.empty")}
        />
      </section>
    </div>
  );
}
