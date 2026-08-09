import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { getTeacherOverview } from "@/modules/analytics/server/queries";
import { Badge, Card, CardBody, EmptyState, PageHeader } from "@/ui";

import { FlagList } from "./_components/FlagBadges";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function TeachPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [overview, t, tCommon] = await Promise.all([
    getTeacherOverview(ctx),
    getTranslations("staff.teach"),
    getTranslations("common"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {overview.classes.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">📚</span>}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overview.classes.map((cls) => (
            <Link key={cls.id} href={`/teach/classes/${cls.id}`}>
              <Card className="h-full transition-colors hover:border-brand/40">
                <CardBody className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate font-display text-lg font-semibold text-ink">
                      {cls.name}
                    </h2>
                    <Badge variant="brand" className="shrink-0">
                      {tCommon("grade", { grade: String(cls.grade) })}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {t("classCard.students", { count: cls.studentCount })}
                  </p>
                  <dl className="mt-1 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-ink-muted">{t("matrix.summary.completion")}</dt>
                      <dd className="font-display text-xl font-bold tabular-nums text-ink">
                        {cls.completionPct}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">{t("matrix.summary.activeThisWeek")}</dt>
                      <dd className="font-display text-xl font-bold tabular-nums text-ink">
                        {cls.activeThisWeek}
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">
          {t("needsAttention.heading")}
        </h2>
        {overview.needsAttention.length === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">✅</span>}
            title={t("needsAttention.empty")}
            description={t("needsAttention.emptyHint")}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.needsAttention.map((entry) => (
              <li key={entry.studentUserId}>
                <Link
                  href={`/teach/classes/${entry.classId}/students/${entry.studentUserId}`}
                  aria-label={t("needsAttention.viewStudent", { name: entry.displayName })}
                  className="block rounded-lg border border-border-token bg-surface-raised p-4 shadow-soft transition-colors hover:border-brand/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-semibold text-ink">
                        {entry.displayName}
                      </span>
                      <span className="text-xs text-ink-muted">{entry.className}</span>
                    </div>
                    <FlagList flags={entry.flags} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
