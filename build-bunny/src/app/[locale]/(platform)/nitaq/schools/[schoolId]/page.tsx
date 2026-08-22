import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  getSchoolDetail,
  listPublishedPrograms,
} from "@/modules/schools/server/platform-queries";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  createDateFormat,
  ErrorState,
  PageHeader,
  StatCard,
  type BadgeVariant,
} from "@/ui";

import { FeatureFlags } from "./_components/FeatureFlags";
import { ProgramPicker } from "./_components/ProgramPicker";
import { SchoolWeekPicker } from "./_components/SchoolWeekPicker";

interface Props {
  params: Promise<{ locale: string; schoolId: string }>;
}

const LICENCE_BADGES: Record<string, BadgeVariant> = {
  ACTIVE: "positive",
  GRACE: "warning",
  READ_ONLY: "neutral",
  SUSPENDED: "danger",
};

export default async function SchoolDetailPage({ params }: Props) {
  const { locale, schoolId } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const [school, programs, t, tLicence, tFeatures, tProgram, tWeek] = await Promise.all([
    getSchoolDetail(ctx, schoolId),
    listPublishedPrograms(ctx),
    getTranslations("platform.schoolDetail"),
    getTranslations("platform.licence"),
    getTranslations("platform.schools.features"),
    getTranslations("platform.schools.program"),
    getTranslations("platform.schools.week"),
  ]);

  const dateFormat = createDateFormat(locale, { dateStyle: "medium" });

  if (!school) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/nitaq/schools" className="text-sm font-semibold text-brand hover:underline">
          {t("backLink")}
        </Link>
        <ErrorState title={t("notFoundTitle")} description={t("notFoundBody")} className="my-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Link href="/nitaq/schools" className="text-sm font-semibold text-brand hover:underline">
        {t("backLink")}
      </Link>
      <PageHeader
        title={school.name}
        description={t("createdAt", { date: dateFormat.format(school.createdAt) })}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("statTeachers")} value={school.counts.teachers} />
        <StatCard label={t("statStudents")} value={school.counts.students} />
        <StatCard label={t("statClasses")} value={school.counts.classes} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("licenceHeading")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {school.licences.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noLicence")}</p>
          ) : (
            school.licences.map((licence) => (
              <div
                key={licence.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-token p-3"
              >
                <Badge variant={LICENCE_BADGES[licence.status] ?? "neutral"}>
                  {tLicence(licence.status)}
                </Badge>
                <span className="text-sm text-ink">
                  {t("seats")}: <span className="tabular-nums">{licence.seats}</span>
                </span>
                <span className="text-sm text-ink">
                  {t("startsAt")}: {dateFormat.format(licence.startsAt)}
                </span>
                <span className="text-sm text-ink">
                  {t("expiresAt")}: {dateFormat.format(licence.expiresAt)}
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* Which curriculum this school's students get. Sits above the feature
          switches deliberately: turning the adventure flag on for a school
          with no programme still shows every child an empty map, so this is
          the more fundamental of the two. */}
      <Card>
        <CardHeader>
          <CardTitle>{tProgram("heading")}</CardTitle>
        </CardHeader>
        <CardBody>
          <ProgramPicker
            schoolId={school.id}
            current={school.program?.id ?? ""}
            programs={programs.map((program) => ({
              id: program.id,
              name: resolveText(program.name, locale),
            }))}
            ambiguous={school.programAmbiguous}
          />
        </CardBody>
      </Card>

      {/* Which days this school teaches on. Sits with the other per-school
          settings because it is one: the streak engine and teacher analytics
          both read it, and until now nothing could write it. */}
      <Card>
        <CardHeader>
          <CardTitle>{tWeek("heading")}</CardTitle>
        </CardHeader>
        <CardBody>
          <SchoolWeekPicker schoolId={school.id} current={school.schoolWeek} />
        </CardBody>
      </Card>

      {/* Per-school surface switches. Before this, a flag could only be
          changed by editing JSONB by hand — which meant anything shipped
          behind one was, in practice, shipped off. */}
      <Card>
        <CardHeader>
          <CardTitle>{tFeatures("heading")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{tFeatures("caveat")}</p>
          <FeatureFlags schoolId={school.id} features={school.features} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("adminsHeading")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-2">
          {school.admins.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noAdmins")}</p>
          ) : (
            school.admins.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">{admin.displayName}</span>
                <span className="text-sm text-ink-muted">{admin.email}</span>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
