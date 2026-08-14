import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { getStudentDetail } from "@/modules/analytics/server/queries";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  createDateFormat,
  DataTable,
  ErrorState,
  PageHeader,
  type DataTableColumn,
} from "@/ui";

import { FlagList } from "../../../../_components/FlagBadges";
import { FeedbackComposer, type FeedbackEntryVM } from "./_components/FeedbackComposer";

interface Props {
  params: Promise<{ locale: string; classId: string; studentId: string }>;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

const VERDICT_VARIANT = {
  PASS: "positive",
  PARTIAL: "warning",
  FAIL: "danger",
  ERROR: "danger",
} as const;

export default async function StudentDetailPage({ params }: Props) {
  const { locale, classId, studentId } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [detail, t, tCommon] = await Promise.all([
    getStudentDetail(ctx, studentId),
    getTranslations("staff.teach.student"),
    getTranslations("common"),
  ]);

  if (!detail) {
    return (
      <ErrorState title={t("notFoundTitle")} description={t("notFoundBody")} className="my-8" />
    );
  }

  const dateFormat = createDateFormat(locale, { dateStyle: "medium" });
  const dateTimeFormat = createDateFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const attemptColumns: DataTableColumn<(typeof detail.recentAttempts)[number]>[] = [
    {
      key: "level",
      header: t("attempts.level"),
      cell: (row) => resolveText(row.levelTitle, locale),
    },
    {
      key: "verdict",
      header: t("attempts.verdict"),
      cell: (row) => <Badge variant={VERDICT_VARIANT[row.verdict]}>{row.verdict}</Badge>,
    },
    {
      key: "stars",
      header: t("attempts.stars"),
      cell: (row) => <span className="tabular-nums">★{row.stars}</span>,
      align: "end",
    },
    {
      key: "blocks",
      header: t("attempts.blocks"),
      cell: (row) => <span className="tabular-nums">{row.blockCount ?? "—"}</span>,
      align: "end",
    },
    {
      key: "hints",
      header: t("attempts.hints"),
      cell: (row) => <span className="tabular-nums">{row.hintTierUsed || "—"}</span>,
      align: "end",
    },
    {
      key: "duration",
      header: t("attempts.duration"),
      cell: (row) => <span dir="ltr">{formatDuration(row.durationMs)}</span>,
    },
    {
      key: "when",
      header: t("attempts.when"),
      cell: (row) => <span dir="ltr">{dateTimeFormat.format(new Date(row.createdAt))}</span>,
    },
    {
      key: "replay",
      header: "",
      align: "end",
      cell: (row) => (
        <Link href={`/teach/attempts/${row.id}`} className="font-semibold text-brand hover:underline">
          {t("attempts.viewReplay")}
        </Link>
      ),
    },
  ];

  const feedbackEntries: FeedbackEntryVM[] = detail.feedback.map((f) => ({
    id: f.id,
    body: f.body,
    teacherDisplayName: f.teacherDisplayName,
    levelTitle: resolveText(f.levelTitle, locale),
    createdAt: f.createdAt.toISOString(),
    readAt: f.readAt ? f.readAt.toISOString() : null,
  }));
  const feedbackLevelOptions = detail.progress.flatMap((world) =>
    world.levels.map((level) => ({ id: level.levelId, label: resolveText(level.title, locale) })),
  );

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/teach/classes/${classId}`}
        className="w-fit text-sm font-semibold text-brand hover:underline"
      >
        {t("backLink")}
      </Link>
      <PageHeader
        title={detail.displayName}
        description={detail.class ? `${detail.class.name} · ${tCommon("grade", { grade: String(detail.class.grade) })}` : t("header.noClass")}
      />

      <Card>
        <CardBody className="flex flex-wrap items-start gap-6">
          <Avatar displayName={detail.displayName} size="lg" />
          <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-ink-muted">{t("header.xp")}</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-ink">{detail.xpTotal}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t("header.stars")}</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-ink">{detail.starsTotal}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t("header.streak")}</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-ink">{detail.streakCurrent}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t("header.lastActive")}</dt>
              <dd className="font-display text-base font-semibold text-ink" dir="ltr">
                {detail.lastActiveAt ? dateFormat.format(new Date(detail.lastActiveAt)) : t("header.never")}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink-muted">{t("header.flagsHeading")}</span>
            {detail.flags.length > 0 ? (
              <FlagList flags={detail.flags} />
            ) : (
              <span className="text-sm text-ink-muted">{t("header.noFlags")}</span>
            )}
          </div>
        </CardBody>
      </Card>

      {/* What to DO about the flags. Renders nothing when the student is
          fine — advice invented for a student who needs none teaches
          teachers to skip the panel. */}
      {detail.interventions.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-ink">
              {t("interventions.heading")}
            </h2>
            <p className="text-sm text-ink-muted">{t("interventions.caveat")}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {detail.interventions.map((suggestion) => (
              <li key={`${suggestion.kind}-${suggestion.levelId ?? "none"}`}>
                <Card>
                  <CardBody className="flex flex-col gap-1.5">
                    <h3 className="font-display text-base font-semibold text-ink">
                      {t(`interventions.kind.${suggestion.kind}.title`)}
                    </h3>
                    {/* The evidence, before the advice: a teacher has to be
                        able to check the claim against the rows below. */}
                    <p className="text-sm text-ink">
                      {t(`interventions.kind.${suggestion.kind}.evidence`, {
                        level:
                          suggestion.levelTitle === null
                            ? ""
                            : resolveText(suggestion.levelTitle, locale),
                        attempts: suggestion.facts.attempts ?? 0,
                        minutes: suggestion.facts.minutes ?? 0,
                        estimatedMinutes: suggestion.facts.estimatedMinutes ?? 0,
                        levels: suggestion.facts.levels ?? 0,
                        days: suggestion.facts.days ?? 0,
                      })}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {t(`interventions.kind.${suggestion.kind}.suggestion`)}
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{t("progress.heading")}</h2>
        {detail.progress.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("progress.empty")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detail.progress.map((world) => (
              <Card key={world.worldSlug}>
                <CardHeader>
                  <CardTitle>{resolveText(world.worldName, locale)}</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-1.5">
                  {world.levels.map((level) => (
                    <div key={level.levelId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-ink">{resolveText(level.title, locale)}</span>
                      <span className="shrink-0 tabular-nums text-ink-muted">
                        {level.status === "COMPLETED" ? `★${level.stars}` : level.status === "LOCKED" ? "🔒" : "…"}
                      </span>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{t("attempts.heading")}</h2>
        <DataTable
          columns={attemptColumns}
          rows={detail.recentAttempts}
          rowKey={(row) => row.id}
          emptyMessage={t("attempts.empty")}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{t("achievements.heading")}</h2>
        {detail.achievements.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("achievements.empty")}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {detail.achievements.map((a) => (
              <div
                key={a.slug}
                className="flex items-center gap-2 rounded-full border border-border-token bg-surface-raised px-3 py-1.5 text-sm"
              >
                <span aria-hidden="true">{a.icon}</span>
                <span className="font-medium text-ink">{resolveText(a.name, locale)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{t("certificates.heading")}</h2>
        {detail.certificates.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("certificates.empty")}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {detail.certificates.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border-token bg-surface-raised px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">{resolveText(c.title, locale)}</span>
                {c.revoked ? <Badge variant="danger">{t("certificates.revoked")}</Badge> : null}
                <a
                  href={`/verify/${c.verifySlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand hover:underline"
                >
                  {t("certificates.verify")}
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{t("feedback.heading")}</h2>
        <FeedbackComposer
          studentUserId={detail.studentUserId}
          levelOptions={feedbackLevelOptions}
          entries={feedbackEntries}
        />
      </section>
    </div>
  );
}
