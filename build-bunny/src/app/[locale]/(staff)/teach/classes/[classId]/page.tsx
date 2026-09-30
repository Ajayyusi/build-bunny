import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { hasPermission } from "@/modules/auth/permissions";
import { resolveText } from "@/modules/curriculum/schemas";
import { requireRole } from "@/modules/auth/server/session";
import {
  getClassAiIdeas,
  getClassHardestLevels,
  getClassMatrix,
  getClassMisconceptions,
  getClassReflections,
} from "@/modules/analytics/server/queries";
import {
  getClassAssignmentProgress,
  listAssignableContent,
  listClassAssignments,
} from "@/modules/assignments/server/queries";
import { Badge, Button, Card, CardBody, ErrorState, PageHeader, StatCard, cn } from "@/ui";

import { AssignmentsManager, type AssignmentRowVM } from "../../_components/AssignmentsManager";
import { MatrixLegend, ProgressMatrix } from "./_components/ProgressMatrix";
import { ExploreLaunchPanel } from "./_components/ExploreLaunchPanel";
import { getClassExploreSettings } from "@/modules/explore/server/queries";

interface Props {
  params: Promise<{ locale: string; classId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ClassPage({ params, searchParams }: Props) {
  const { locale, classId } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [matrix, hardestLevels, misconceptions, reflections, aiIdeas, exploreSettings, t, tCommon, tExplore, tCheck] = await Promise.all([
    getClassMatrix(ctx, classId),
    getClassHardestLevels(ctx, classId),
    getClassMisconceptions(ctx, classId),
    getClassReflections(ctx, classId),
    getClassAiIdeas(ctx, classId),
    getClassExploreSettings(ctx, classId),
    getTranslations("staff.teach.matrix"),
    getTranslations("common"),
    getTranslations("student.explore"),
    getTranslations("student.play.check"),
  ]);

  if (!matrix) {
    return (
      <ErrorState
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        className="my-8"
      />
    );
  }

  const activeTab = tab === "assignments" ? "assignments" : "matrix";
  const tabClass = (active: boolean) =>
    cn(
      "inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors",
      active ? "bg-brand/10 text-brand" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={matrix.className}
        description={tCommon("grade", { grade: String(matrix.grade) })}
        actions={
          <Link href={`/teach/classes/${classId}/live`}>
            <Button variant="secondary">
              <span aria-hidden="true">📽️</span>
              {t("liveLink")}
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("summary.students")} value={matrix.summary.studentCount} />
        <StatCard label={t("summary.completion")} value={`${matrix.summary.completionPct}%`} />
        <StatCard label={t("summary.avgStars")} value={matrix.summary.avgStars} />
        <StatCard label={t("summary.activeThisWeek")} value={matrix.summary.activeThisWeek} />
      </div>

      {/* Where THIS class is struggling. Names levels, never children: the
          numbers are class aggregates, and the point is to tell a teacher
          what to reteach, not who to single out. */}
      {hardestLevels.length > 0 ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-base font-semibold text-ink">
                {t("hardest.heading")}
              </h2>
              <p className="text-sm text-ink-muted">{t("hardest.caveat")}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {hardestLevels.map((level) => (
                <li
                  key={level.levelId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken px-3 py-2"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">
                      {resolveText(level.title, locale)}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {resolveText(level.worldName, locale)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-ink-muted tabular-nums">
                      {t("hardest.attempts", { attempts: level.attempts })}
                    </span>
                    <Badge variant={level.failRatePct >= 50 ? "danger" : "warning"}>
                      {t("hardest.failRate", { pct: level.failRatePct })}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* What the class keeps getting wrong, as ideas to reteach: the located
          feedback of every graded run in the last month, grouped. Aggregates
          only — it names ideas and levels, never children. */}
      {misconceptions.length > 0 ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-base font-semibold text-ink">
                {t("misconceptions.heading")}
              </h2>
              <p className="text-sm text-ink-muted">{t("misconceptions.caveat")}</p>
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {misconceptions.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 rounded-lg bg-surface-sunken px-3 py-2"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {t(`misconceptions.kind.${item.id}.label`)}
                    </span>
                    <span className="text-xs text-ink-muted tabular-nums">
                      {t("misconceptions.meta", { attempts: item.attempts, students: item.students })}
                    </span>
                  </span>
                  {item.levels.length > 0 ? (
                    <span className="text-xs text-ink-muted">
                      {item.levels.map((level) => resolveText(level.title, locale)).join(" · ")}
                    </span>
                  ) : null}
                  <span className="text-sm text-ink">
                    {t(`misconceptions.kind.${item.id}.reteach`)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* Activity launch control: which Explore AI activities this class
          sees, and the one pinned as "Today's AI activity". */}
      {exploreSettings ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-base font-semibold text-ink">{t("launch.heading")}</h2>
              <p className="text-sm text-ink-muted">{t("launch.help")}</p>
            </div>
            <ExploreLaunchPanel
              classId={classId}
              canManage={exploreSettings.canManage}
              rows={exploreSettings.activities.map((activity) => ({
                slug: activity.slug,
                glyph: activity.glyph,
                concept: tExplore(`concept.${activity.concept}.name`),
                title: activity.title ? resolveText(activity.title, locale) : tExplore(`concept.${activity.concept}.name`),
                open: activity.open,
                launched: activity.launched,
              }))}
            />
          </CardBody>
        </Card>
      ) : null}

      {/* The AI ideas behind Explore AI: finished vs understood, as class
          totals (redesign brief 2026-09-25). */}
      {aiIdeas && aiIdeas.ideas.length > 0 && aiIdeas.students > 0 ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-base font-semibold text-ink">{t("aiIdeas.heading")}</h2>
              <p className="text-sm text-ink-muted">{t("aiIdeas.caveat")}</p>
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {aiIdeas.ideas.map((idea) => (
                <li key={idea.levelId} className="flex flex-col gap-1 rounded-lg bg-surface-sunken px-3 py-2">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-sm font-semibold text-ink">{tExplore(`concept.${idea.concept}.name`)}</span>
                    <span className="text-xs text-ink-muted">{resolveText(idea.title, locale)}</span>
                  </span>
                  <span className="text-xs text-ink tabular-nums">
                    {t("aiIdeas.finished", { finished: idea.finished, students: aiIdeas.students })}
                  </span>
                  <span className="text-xs text-ink-muted tabular-nums">
                    {idea.answered > 0
                      ? t("aiIdeas.firstTry", { firstTry: idea.firstTry, answered: idea.answered })
                      : t("aiIdeas.noAnswers")}
                  </span>
                  <span className="text-xs text-ink-muted tabular-nums">
                    {t("aiIdeas.activity", { ...idea.activity })}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* The five AI concepts: who is secure, working on it or not started,
          by grade band, with checks, retries and the most common wrong idea.
          Class totals only. */}
      {aiIdeas && aiIdeas.students > 0 && aiIdeas.concepts.some((c) => c.levels > 0) ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-base font-semibold text-ink">{t("aiConcepts.heading")}</h2>
              <p className="text-sm text-ink-muted">{t("aiConcepts.rule")}</p>
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {aiIdeas.concepts
                .filter((c) => c.levels > 0)
                .map((c) => {
                  const total = c.secure + c.working + c.notStarted;
                  return (
                    <li key={c.concept} className="flex flex-col gap-1 rounded-lg bg-surface-sunken px-3 py-2">
                      <span className="text-sm font-semibold text-ink">{t(`aiConcepts.name.${c.concept}`)}</span>
                      <span aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-surface-raised">
                        <span className="bg-positive" style={{ width: `${total ? (c.secure / total) * 100 : 0}%` }} />
                        <span className="bg-accent" style={{ width: `${total ? (c.working / total) * 100 : 0}%` }} />
                      </span>
                      <span className="text-xs text-ink tabular-nums">
                        {t("aiConcepts.mastery", { secure: c.secure, working: c.working, notStarted: c.notStarted })}
                      </span>
                      <span className="text-xs text-ink-muted tabular-nums">
                        {t("aiConcepts.bands", {
                          youngSecure: c.byBand.younger.secure,
                          young: c.byBand.younger.students,
                          oldSecure: c.byBand.older.secure,
                          old: c.byBand.older.students,
                        })}
                      </span>
                      <span className="text-xs text-ink-muted tabular-nums">
                        {t("aiConcepts.activity", { attempts: c.attempts, retries: c.retries })}
                      </span>
                      {c.misconception ? (
                        <span className="text-xs text-ink">
                          {t("aiConcepts.misconception", {
                            count: c.misconception.count,
                            answer: tCheck(`${c.misconception.checkConcept}.${c.misconception.choice}`),
                          })}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* How the class felt: the one-tap reflection after each level. Counts
          only, never who said what. */}
      {reflections.length > 0 ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-base font-semibold text-ink">{t("reflections.heading")}</h2>
              <p className="text-sm text-ink-muted">{t("reflections.caveat")}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {reflections.map((level) => (
                <li
                  key={level.levelId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken px-3 py-2"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">{resolveText(level.title, locale)}</span>
                    <span className="text-xs text-ink-muted">{resolveText(level.worldName, locale)}</span>
                  </span>
                  <Badge variant={level.band === "most" ? "warning" : "neutral"}>
                    {t(level.band === "most" ? "reflections.most" : "reflections.some")}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <nav
        aria-label={t("assignmentsLink")}
        className="flex flex-wrap items-center gap-1 border-b border-border-token pb-1"
      >
        <Link
          href={`/teach/classes/${classId}`}
          aria-current={activeTab === "matrix" ? "page" : undefined}
          className={tabClass(activeTab === "matrix")}
        >
          {t("tabLabel")}
        </Link>
        <Link
          href={`/teach/classes/${classId}?tab=assignments`}
          aria-current={activeTab === "assignments" ? "page" : undefined}
          className={tabClass(activeTab === "assignments")}
        >
          {t("assignmentsLink")}
        </Link>
      </nav>

      {activeTab === "matrix" ? (
        <div className="flex flex-col gap-4">
          <MatrixLegend />
          <ProgressMatrix matrix={matrix} classId={classId} locale={locale} />
        </div>
      ) : (
        <ClassAssignmentsTab ctx={ctx} classId={classId} className={matrix.className} grade={matrix.grade} />
      )}
    </div>
  );
}

async function ClassAssignmentsTab({
  ctx,
  classId,
  className,
  grade,
}: {
  ctx: Awaited<ReturnType<typeof requireRole>>;
  classId: string;
  className: string;
  grade: number;
}) {
  const [assignments, content, progress] = await Promise.all([
    listClassAssignments(ctx, classId),
    listAssignableContent(ctx),
    getClassAssignmentProgress(ctx, classId),
  ]);
  const progressById = new Map(progress.map((row) => [row.assignmentId, row]));
  const rows: AssignmentRowVM[] = assignments.map((a) => ({
    id: a.id,
    classId: a.classId,
    className: a.className,
    target: a.target,
    targetLabel: a.targetLabel,
    title: a.title,
    note: a.note,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    closedAt: a.closedAt ? a.closedAt.toISOString() : null,
    createdByName: a.createdByName,
    progress: progressById.get(a.id) ?? null,
  }));

  return (
    <AssignmentsManager
      assignments={rows}
      classes={[{ id: classId, name: className, grade }]}
      fixedClassId={classId}
      worlds={content.worlds}
      canManage={hasPermission(ctx.role, "assignments:manage")}
    />
  );
}
