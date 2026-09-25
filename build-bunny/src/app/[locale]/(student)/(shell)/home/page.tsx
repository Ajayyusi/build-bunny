import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { MusicScene } from "@/modules/audio/scene";
import { requireRole } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  computeAdventureState,
  type AdventureWorldNode,
} from "@/modules/learning/server/adventure";
import { recommendWarmUp } from "@/modules/learning/server/recommend";
import { listMyStudentAssignments } from "@/modules/assignments/server/queries";
import { getExploreState } from "@/modules/explore/server/queries";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyFeedback, getMyStudentSnapshot } from "@/modules/students/server/queries";
import { BunnyMascot, CountUp, EmptyState, createDateFormat } from "@/ui";

import { themeEmoji } from "../adventure/_components/theme";
import { ExploreTile } from "../explore/_components/ExploreTile";
import { toTile } from "../explore/_components/to-tiles";
import { AssignmentsCard } from "./_components/AssignmentsCard";
import { FeedbackInbox } from "./_components/FeedbackInbox";
import { Onboarding } from "./_components/Onboarding";
import { WorldCard, type WorldCardVM } from "./_components/WorldCard";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function StudentHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");
  const [snapshot, assignments, feedback, t, tKind, tExplore] = await Promise.all([
    getMyStudentSnapshot(ctx),
    listMyStudentAssignments(ctx),
    getMyFeedback(ctx),
    getTranslations("student.home"),
    getTranslations("student.adventure.kind"),
    getTranslations("student.explore"),
  ]);
  const feedbackDate = createDateFormat(locale, { dateStyle: "medium" });
  const displayName = snapshot?.user.displayName ?? ctx.displayName;
  const adventureEnabled = isFeatureEnabled(
    snapshot?.school.features,
    "adventure",
  );

  // Only reach for the curriculum when the map is actually on for this
  // school — otherwise the dashboard has nothing to show from it.
  const state = adventureEnabled ? await computeAdventureState(ctx) : null;
  const playableWorlds =
    state?.worlds.filter(
      (w: AdventureWorldNode) => !w.horizon && w.totalLevels > 0,
    ) ?? [];

  const totalLevels = playableWorlds.reduce((n, w) => n + w.totalLevels, 0);
  const doneLevels = playableWorlds.reduce((n, w) => n + w.completedLevels, 0);

  // The world holding the current level anchors the hero copy.
  const currentWorld =
    playableWorlds.find((w: AdventureWorldNode) =>
      w.modules.some((m) => m.levels.some((l) => l.current)),
    ) ?? null;
  const currentLevel =
    currentWorld?.modules
      .flatMap((m) => m.levels)
      .find((l) => l.current) ?? null;
  const fresh = doneLevels === 0;
  // The hero's main action is the NEXT LEVEL itself, not the map: a child
  // who has to find their place on a trail before they can play is a child
  // waiting for a teacher. The map stays one tap away as the second action.
  const currentLevelHref = state?.currentLevelId
    ? `/play/${state.currentLevelId}`
    : null;
  // A warm-up is offered only when observable signals say the child is stuck
  // on the current level (failed runs + hints); it never replaces the level.
  const warmUp = state ? await recommendWarmUp(ctx, state) : null;
  // Explore AI reuses the adventure state already computed above.
  const explore = state ? await getExploreState(ctx, state) : null;

  const worldCards: WorldCardVM[] = playableWorlds.map(
    (w: AdventureWorldNode) => ({
      id: w.id,
      name: resolveText(w.name, locale),
      theme: w.theme,
      emoji: themeEmoji(w.theme),
      completedLevels: w.completedLevels,
      totalLevels: w.totalLevels,
      locked: w.state === "LOCKED",
      kind: w.kind,
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <MusicScene track="map" />
      {/* A student who has never earned XP has never finished a level, so
          this is their first visit — Bunny introduces the place. */}
      <Onboarding
        show={(snapshot?.xpTotal ?? 0) === 0}
        userId={ctx.userId}
        firstMissionHref={currentLevelHref}
      />

      {warmUp ? (
        <section
          aria-label={t("warmUpTitle", { level: resolveText(warmUp.stuckTitle, locale) })}
          className="flex flex-col gap-3 rounded-2xl border-2 border-info/40 bg-info/10 p-5 sm:flex-row sm:items-center"
        >
          <BunnyMascot state="thinking" size="sm" className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="font-display text-base font-bold text-ink">
              {t("warmUpTitle", { level: resolveText(warmUp.stuckTitle, locale) })}
            </h2>
            <p className="text-sm text-ink-muted">{t("warmUpBody")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/play/${warmUp.levelId}`}
              className="bb-go inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm"
            >
              <span aria-hidden="true">🐰</span>
              {t("warmUpCta", { level: resolveText(warmUp.title, locale) })}
            </Link>
            <Link
              href={`/play/${warmUp.stuckLevelId}`}
              className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {t("warmUpSkip")}
            </Link>
          </div>
        </section>
      ) : null}

      <AssignmentsCard assignments={assignments} locale={locale} />

      {/* Messages from a teacher sit beside the work they were set — this is
          the delivery half of a loop that previously only had a sender. */}
      <FeedbackInbox
        items={feedback.map((item) => ({
          id: item.id,
          body: item.body,
          teacherName: item.teacherName,
          levelId: item.levelId,
          levelTitle: resolveText(item.levelTitle, locale),
          dateLabel: feedbackDate.format(item.createdAt),
          read: item.readAt !== null,
        }))}
      />

      {/* ── Row 1: hero + progress panels ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* Hero — "pick up where you left off" */}
        <section className="bb-cascade relative overflow-hidden rounded-2xl bg-surface-raised p-6 shadow-raised sm:p-8">
          {/* Decorative mascot, hidden from AT and from narrow screens where
              it would crowd the copy. */}
          <BunnyMascot
            state="waving"
            size="lg"
            className="pointer-events-none absolute -bottom-2 end-4 hidden opacity-95 sm:block"
          />

          <div className="relative flex max-w-md flex-col items-start gap-3 sm:pe-28">
            <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-wide text-on-brand">
              {t("kicker")}
            </span>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              {fresh ? t("greeting", { name: displayName }) : t("heroTitle")}
            </h1>
            <p className="text-sm text-ink-muted">
              {currentWorld && !fresh
                ? t("heroBody", {
                    world: resolveText(currentWorld.name, locale),
                  })
                : t("heroBodyFresh")}
            </p>
            {adventureEnabled ? (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Link
                  href={currentLevelHref ?? "/adventure"}
                  className="bb-pop bb-go inline-flex h-12 max-w-full items-center gap-2 rounded-lg px-5 text-base"
                >
                  <span aria-hidden="true">▶</span>
                  <span className="truncate">
                    {!currentLevelHref
                      ? t("heroCtaDone")
                      : fresh
                        ? t("heroCtaFresh")
                        : t("heroCta", {
                            title: currentLevel
                              ? resolveText(currentLevel.title, locale)
                              : "",
                          })}
                  </span>
                </Link>
                {currentLevelHref ? (
                  <Link
                    href="/adventure"
                    className="inline-flex h-12 items-center rounded-lg px-3 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    {t("openMap")}
                  </Link>
                ) : null}
                {currentLevel ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                    <span aria-hidden="true">🕒</span>
                    {t("heroMinutes", {
                      minutes: currentLevel.estimatedMinutes,
                    })}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {/* XP + badges rail */}
        <div className="flex flex-col gap-4">
          <section
            className="bb-cascade bb-ledge-brand rounded-2xl bg-brand p-5 text-on-brand"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <h2 className="font-display text-base font-bold">
              {t("xpPanelTitle")}
            </h2>
            <p className="mt-0.5 text-xs">{t("xpPanelBody")}</p>
            <p className="mt-4 font-display text-3xl font-bold tabular-nums">
              <CountUp value={snapshot?.xpTotal ?? 0} />
              <span className="ms-1 text-base font-bold">XP</span>
            </p>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <section
              className="bb-cascade flex flex-col justify-between rounded-2xl border border-border-token bg-surface-raised p-4 shadow-soft"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              <span
                aria-hidden="true"
                className="bb-twinkle grid size-9 place-items-center rounded-xl bg-accent/25 text-lg"
              >
                ⭐
              </span>
              <p className="mt-3 font-display text-2xl font-bold tabular-nums text-ink">
                <CountUp value={snapshot?.starsTotal ?? 0} />
              </p>
              <p className="text-xs text-ink-muted">{t("stars")}</p>
            </section>

            <section
              className="bb-cascade flex flex-col justify-between rounded-2xl border border-border-token bg-surface-raised p-4 shadow-soft"
              style={{ "--i": 3 } as React.CSSProperties}
            >
              {/* Levels finished, not a day streak: a streak counter on a
                  child's home screen is pressure to show up, and it resets
                  to zero over a school holiday. What they have built stays. */}
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-xl bg-brand/15 text-lg"
              >
                🏁
              </span>
              <p className="mt-3 font-display text-2xl font-bold tabular-nums text-ink">
                <CountUp value={doneLevels} />
              </p>
              <p className="text-xs text-ink-muted">{t("levelsDone")}</p>
            </section>
          </div>
        </div>
      </div>

      {/* ── Explore AI: hands-on AI from the first session, no coding
          first (redesign brief 2026-09-25). One tap from Home. ──────── */}
      {explore && explore.cards.length > 0 ? (
        <section aria-labelledby="home-explore" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 id="home-explore" className="font-display text-lg font-bold text-ink">
                <span aria-hidden="true">🧠 </span>
                {tExplore("homeTitle")}
              </h2>
              <p className="text-sm text-ink-muted">{tExplore("homeBody")}</p>
            </div>
            <Link
              href="/explore"
              className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              {tExplore("homeSeeAll")}
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {explore.cards.map((card, index) => (
              <ExploreTile key={card.slug} tile={toTile(card, tExplore, locale)} index={index} compact />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Row 2: the roadmap grid ───────────────────────────────────── */}
      {adventureEnabled && worldCards.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              {t("roadmapTitle")}
            </h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-bold text-ink-muted">
                {t("roadmapWorlds", { count: worldCards.length })}
              </span>
              <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-bold text-ink-muted">
                {t("roadmapLevels", { count: totalLevels })}
              </span>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {worldCards.map((world, i) => (
              <WorldCard
                key={world.id}
                world={world}
                index={i}
                levelsLabel={t("worldChapters", { count: world.totalLevels })}
                lockedLabel={t("worldLocked")}
                kindLabel={tKind(world.kind)}
                progressSr={t("worldProgressSr", {
                  done: world.completedLevels,
                  total: world.totalLevels,
                })}
              />
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon={<BunnyMascot state="sleeping" size="sm" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      )}
    </div>
  );
}
