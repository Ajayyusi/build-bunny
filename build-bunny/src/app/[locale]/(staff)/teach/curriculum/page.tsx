import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import { getTeacherCurriculumGuide, LESSON_MINUTES, lessonsFor } from "@/modules/curriculum/server/guide";
import { ageBandFor } from "@/modules/learning/age-band";
import { Badge, Card, CardBody, EmptyState, PageHeader } from "@/ui";

import { PrintButton } from "../_components/PrintButton";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * The teacher's curriculum guide (brief §6): objectives, concepts, age
 * bands, timing and teacher notes for every published level, world by
 * world, with a pacing line per module ("about 3 lessons of 40 minutes").
 * Printable as a whole — the page carries its own print styles, and the
 * staff chrome is already hidden in print.
 */
export default async function CurriculumGuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [worlds, t, tIntro] = await Promise.all([
    getTeacherCurriculumGuide(ctx),
    getTranslations("staff.teach.curriculum"),
    getTranslations("student.adventure.intro"),
  ]);

  const totalLevels = worlds.reduce((sum, w) => sum + w.levelCount, 0);
  const totalMinutes = worlds.reduce((sum, w) => sum + w.totalMinutes, 0);

  return (
    <div className="flex flex-col gap-6 print:gap-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle", {
          levels: totalLevels,
          worlds: worlds.length,
          lessons: lessonsFor(totalMinutes),
          minutes: LESSON_MINUTES,
        })}
        actions={<PrintButton label={t("print")} />}
      />

      {worlds.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
      ) : null}

      {worlds.map((world, index) => (
        <Card key={world.id} className="print:break-inside-avoid print:border-0 print:shadow-none">
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-xl font-bold text-ink">
                {index + 1}. {resolveText(world.name, locale)}
              </h2>
              {world.tagline ? (
                <p className="text-sm text-ink-muted">{resolveText(world.tagline, locale)}</p>
              ) : null}
              <p className="text-sm text-ink-muted">
                {t("worldPacing", {
                  levels: world.levelCount,
                  lessons: lessonsFor(world.totalMinutes),
                  minutes: LESSON_MINUTES,
                })}
                {world.power ? ` · ${t("power", { power: resolveText(world.power.name, locale) })}` : ""}
              </p>
            </div>

            {world.modules.map((mod) => (
              <section key={mod.id} className="flex flex-col gap-2 print:break-inside-avoid">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-ink">
                    {resolveText(mod.name, locale)}
                  </h3>
                  <span className="text-xs text-ink-muted">
                    {t("modulePacing", {
                      levels: mod.levels.length,
                      total: mod.totalMinutes,
                      lessons: lessonsFor(mod.totalMinutes),
                      minutes: LESSON_MINUTES,
                    })}
                  </span>
                </div>
                {mod.description ? (
                  <p className="text-sm text-ink-muted">{resolveText(mod.description, locale)}</p>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse text-sm">
                    <thead>
                      <tr className="text-start text-xs uppercase tracking-wide text-ink-muted">
                        <th scope="col" className="py-1 pe-3 text-start font-semibold">{t("col.level")}</th>
                        <th scope="col" className="py-1 pe-3 text-start font-semibold">{t("col.type")}</th>
                        <th scope="col" className="py-1 pe-3 text-start font-semibold">{t("col.concepts")}</th>
                        <th scope="col" className="py-1 pe-3 text-start font-semibold">{t("col.ages")}</th>
                        <th scope="col" className="py-1 pe-3 text-start font-semibold">{t("col.minutes")}</th>
                        <th scope="col" className="py-1 text-start font-semibold">{t("col.objective")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mod.levels.map((level) => {
                        const band = ageBandFor(level.recommendedGradeMin);
                        return (
                          <tr key={level.id} className="border-t border-border-token align-top">
                            <td className="py-2 pe-3">
                              <span className="font-semibold text-ink">
                                {level.order}. {resolveText(level.title, locale)}
                              </span>
                              {level.mission ? (
                                <span className="block text-xs text-ink-muted">
                                  {resolveText(level.mission, locale)}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2 pe-3 whitespace-nowrap">
                              <Badge variant="neutral">
                                {t.has(`type.${level.activityType}`)
                                  ? t(`type.${level.activityType}`)
                                  : level.activityType}
                              </Badge>
                            </td>
                            <td className="py-2 pe-3 text-ink-muted">{level.tags.join(", ")}</td>
                            <td className="py-2 pe-3 whitespace-nowrap text-ink-muted">
                              {band ? tIntro(`ageBand.${band}`) : "—"}
                            </td>
                            <td className="py-2 pe-3 whitespace-nowrap tabular-nums text-ink-muted">
                              {level.estimatedMinutes}
                            </td>
                            <td className="py-2 text-ink">
                              {level.objective ? resolveText(level.objective, locale) : "—"}
                              {level.teacherNotes ? (
                                <span className="mt-1 block rounded-md bg-surface-sunken px-2 py-1 text-xs text-ink-muted print:bg-transparent print:px-0">
                                  <span className="font-semibold">{t("teacherNotes")}:</span>{" "}
                                  {resolveText(level.teacherNotes, locale)}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
