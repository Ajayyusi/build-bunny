import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { resolveText } from "@/modules/curriculum/schemas";
import { getFamilySummary } from "@/modules/family/server/summary";
import { BunnyMascot, Card, CardBody, formatDisplayDate } from "@/ui";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

// A private link: never indexed, never cached for anyone else.
// The token is in the path: never send it on as a referrer, never index it.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/**
 * The family view (brief §6): a read-only weekly summary of one child's
 * progress, reached by a private link a teacher shared. No login and no
 * actions — nothing here can change anything. Shows only what a family
 * needs: this week, the worlds and Powers, and what the child is learning
 * now. Unknown, revoked and expired links all read "this link isn't
 * active", which never reveals which.
 */
export default async function FamilyPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const [t, tCommon, summary] = await Promise.all([
    getTranslations("family"),
    getTranslations("common"),
    getFamilySummary(token),
  ]);

  return (
    <div data-theme="play" className="flex min-h-dvh flex-col bg-surface text-ink">
      <header className="bb-container flex h-16 items-center">
        <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-bold">
          <BunnyMascot size="xs" />
          {tCommon("appName")}
        </Link>
      </header>
      <main className="bb-container flex flex-1 flex-col gap-6 py-8">
        {!summary ? (
          <Card className="mx-auto w-full max-w-md">
            <CardBody className="flex flex-col items-center gap-2 py-8 text-center">
              <span aria-hidden className="text-3xl">🔒</span>
              <h1 className="font-display text-xl font-bold">{t("inactiveTitle")}</h1>
              <p className="text-sm text-ink-muted">{t("inactiveBody")}</p>
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-3xl font-bold">
                {t("title", { name: summary.displayName })}
              </h1>
              <p className="text-ink-muted">
                {t("subtitle", {
                  school: summary.schoolName,
                  date: formatDisplayDate(summary.weekStart, locale),
                })}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label={t("stat.levelsThisWeek")} value={summary.thisWeek.levelsCompleted} />
              <Stat label={t("stat.activeDays")} value={summary.thisWeek.activeDays} />
              <Stat label={t("stat.stars")} value={summary.totals.stars} />
            </div>

            {summary.learningNow ? (
              <Card>
                <CardBody className="flex flex-col gap-1">
                  <h2 className="font-display text-lg font-semibold">{t("learningNow")}</h2>
                  <p className="font-semibold">{resolveText(summary.learningNow.title, locale)}</p>
                  {summary.learningNow.mission ? (
                    <p className="text-sm text-ink-muted">{resolveText(summary.learningNow.mission, locale)}</p>
                  ) : null}
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardBody className="flex flex-col gap-2">
                <h2 className="font-display text-lg font-semibold">{t("thisWeek")}</h2>
                {summary.thisWeek.levelTitles.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {summary.thisWeek.levelTitles.map((title, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <span aria-hidden>✅</span>
                        {resolveText(title, locale)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">{t("quietWeek")}</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex flex-col gap-3">
                <h2 className="font-display text-lg font-semibold">{t("worlds")}</h2>
                <ul className="flex flex-col gap-3">
                  {summary.worlds.map((world, index) => {
                    const pct = world.total > 0 ? Math.round((world.completed / world.total) * 100) : 0;
                    return (
                      <li key={index} className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-semibold">{resolveText(world.name, locale)}</span>
                          <span className="text-ink-muted tabular-nums">
                            {t("worldProgress", { completed: world.completed, total: world.total })}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={resolveText(world.name, locale)}
                          className="h-2 overflow-hidden rounded-full bg-surface-sunken"
                        >
                          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                        {world.power && world.powerEarned ? (
                          <span className="text-xs text-ink-muted">
                            <span aria-hidden>{world.power.glyph} </span>
                            {t("powerEarned", { power: resolveText(world.power.name, locale) })}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>

            <p className="text-xs text-ink-muted">
              {t("privacy", { date: formatDisplayDate(summary.expiresAt, locale) })}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-1">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className="font-display text-3xl font-bold tabular-nums">{value}</span>
      </CardBody>
    </Card>
  );
}
