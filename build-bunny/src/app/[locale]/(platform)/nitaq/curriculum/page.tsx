import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { PublishWorldButton } from "./_components/PublishWorldButton";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  listCurriculumPrograms,
  listCurriculumWorlds,
  type CurriculumLevelRow,
} from "@/modules/curriculum/server/queries";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  PageHeader,
  type BadgeVariant,
  type DataTableColumn,
} from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

const STATUS_BADGES: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  PUBLISHED: "positive",
  ARCHIVED: "danger",
};

const ACTIVITY_KEYS = [
  "BLOCK_CODING",
  "CODE_PREDICTION",
  "DEBUGGING",
  "SEQUENCING",
] as const;

function isActivityKey(value: string): value is (typeof ACTIVITY_KEYS)[number] {
  return (ACTIVITY_KEYS as readonly string[]).includes(value);
}

const DIFFICULTY_KEYS = ["EASY", "MEDIUM", "HARD"] as const;

function isDifficultyKey(value: string): value is (typeof DIFFICULTY_KEYS)[number] {
  return (DIFFICULTY_KEYS as readonly string[]).includes(value);
}

export default async function CurriculumPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const [programs, worlds, t] = await Promise.all([
    listCurriculumPrograms(ctx),
    listCurriculumWorlds(ctx),
    getTranslations("platform.curriculum"),
  ]);

  const levelColumns: DataTableColumn<CurriculumLevelRow>[] = [
    {
      key: "order",
      header: t("levels.order"),
      cell: (row) => <span className="tabular-nums">{row.order}</span>,
      align: "end",
      className: "w-12",
    },
    {
      key: "title",
      header: t("levels.title"),
      cell: (row) => (
        <Link
          href={`/nitaq/curriculum/level/${row.id}`}
          className="font-medium text-brand hover:underline"
        >
          {resolveText(row.title, locale)}
        </Link>
      ),
    },
    {
      key: "activity",
      header: t("levels.activity"),
      cell: (row) =>
        isActivityKey(row.activityType)
          ? t(`activity.${row.activityType}`)
          : row.activityType,
    },
    {
      key: "difficulty",
      header: t("levels.difficulty"),
      cell: (row) =>
        isDifficultyKey(row.difficulty)
          ? t(`difficulty.${row.difficulty}`)
          : row.difficulty,
    },
    {
      key: "status",
      header: t("levels.status"),
      cell: (row) => (
        <Badge variant={STATUS_BADGES[row.status] ?? "neutral"}>
          {t(`status.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: "arabic",
      header: t("levels.arabic"),
      cell: (row) =>
        row.arComplete ? (
          <Badge variant="accent">{t("arReady")}</Badge>
        ) : (
          <Badge variant="neutral">{t("arMissing")}</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link
            href="/nitaq/curriculum/import"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong"
          >
            {t("importCta")}
          </Link>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">
          {t("programsHeading")}
        </h2>
        {programs.length === 0 ? (
          <EmptyState title={t("programsEmptyTitle")} description={t("programsEmptyBody")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {programs.map((program) => (
              <Card key={program.id}>
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <CardTitle>{resolveText(program.name, locale)}</CardTitle>
                  <Badge variant={STATUS_BADGES[program.status] ?? "neutral"}>
                    {t(`status.${program.status}`)}
                  </Badge>
                </CardHeader>
                <CardBody className="flex flex-col gap-2 text-sm text-ink-muted">
                  {program.description ? (
                    <p>{resolveText(program.description, locale)}</p>
                  ) : null}
                  <p className="font-medium text-ink">
                    {t("grades", { min: program.gradeMin, max: program.gradeMax })}
                  </p>
                  <p className="tabular-nums">
                    {t("counts", {
                      worlds: program.worldCount,
                      modules: program.moduleCount,
                      levels: program.levelCount,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="positive">
                      {t("publishedCount", {
                        published: program.statusRollup.PUBLISHED,
                        total: program.levelCount,
                      })}
                    </Badge>
                    {program.statusRollup.REVIEW > 0 ? (
                      <Badge variant="warning">
                        {t("reviewCount", { count: program.statusRollup.REVIEW })}
                      </Badge>
                    ) : null}
                    {program.statusRollup.DRAFT > 0 ? (
                      <Badge variant="neutral">
                        {t("draftCount", { count: program.statusRollup.DRAFT })}
                      </Badge>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("worldsHeading")}</h2>
        {worlds.length === 0 ? (
          <EmptyState title={t("worldsEmptyTitle")} description={t("worldsEmptyBody")} />
        ) : (
          <div className="flex flex-col gap-4">
            {worlds.map((world) => (
              <Card key={world.id}>
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <CardTitle>{resolveText(world.name, locale)}</CardTitle>
                    {world.tagline ? (
                      <p className="text-sm text-ink-muted">
                        {resolveText(world.tagline, locale)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {world.horizon ? (
                      <Badge variant="brand">{t("horizon")}</Badge>
                    ) : null}
                    <Badge variant={STATUS_BADGES[world.status] ?? "neutral"}>
                      {t(`status.${world.status}`)}
                    </Badge>
                    {world.levelCount > 0 ? (
                      <>
                        <Badge variant="positive">
                          {t("publishedCount", {
                            published: world.publishedCount,
                            total: world.levelCount,
                          })}
                        </Badge>
                        <Badge variant="accent">
                          {t("arCoverage", {
                            done: world.arCompleteCount,
                            total: world.levelCount,
                          })}
                        </Badge>
                      </>
                    ) : null}
                  </div>
                  {world.horizon ? null : (
                    <PublishWorldButton
                      worldId={world.id}
                      worldName={resolveText(world.name, locale)}
                      pendingCount={
                        world.modules
                          .flatMap((m) => m.levels)
                          .filter((l) => l.status !== "PUBLISHED" && l.status !== "ARCHIVED").length
                      }
                    />
                  )}
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                  {world.horizon ? (
                    <p className="text-sm text-ink-muted">{t("horizonHint")}</p>
                  ) : world.modules.length === 0 ? (
                    <p className="text-sm text-ink-muted">{t("noModules")}</p>
                  ) : (
                    world.modules.map((module) => (
                      <div key={module.id} className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold text-ink">
                          {module.order}. {resolveText(module.name, locale)}
                        </h3>
                        <DataTable
                          columns={levelColumns}
                          rows={module.levels}
                          rowKey={(row) => row.id}
                          emptyMessage={t("levels.empty")}
                        />
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
