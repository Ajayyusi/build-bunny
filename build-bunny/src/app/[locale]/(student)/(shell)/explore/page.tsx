import { getTranslations, setRequestLocale } from "next-intl/server";
import { AiSurface } from "../_components/AiSurface";

import { Link, redirect } from "@/i18n/navigation";
import { listMyStudentAssignments } from "@/modules/assignments/server/queries";
import { MusicScene } from "@/modules/audio/scene";
import { requireRole } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import { getExploreState } from "@/modules/explore/server/queries";
import { computeAdventureState } from "@/modules/learning/server/adventure";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot, getMyUnreadFeedbackCount } from "@/modules/students/server/queries";
import { BunnyMascot, EmptyState } from "@/ui";

import { ExploreTile } from "./_components/ExploreTile";
import { ExploreWelcome } from "./_components/ExploreWelcome";
import { AiModeSwitch } from "./_components/AiModeSwitch";
import { aiModeFor, choiceOf } from "@/modules/students/ai-mode";
import { RouteCard } from "./_components/RouteCard";
import { landingNotices, routeProgress } from "./_components/landing";
import { toTile } from "./_components/to-tiles";

interface Props {
  params: Promise<{ locale: string }>;
}

/** The first AI activity, where the welcome's "Let's try!" leads. */
const FIRST_ACTIVITY = "train-a-sorter";

/**
 * Explore AI — the student landing (redesign brief 2026-09-25, AI-first).
 *
 * Top to bottom: a one-line header; anything a teacher sent (unread
 * messages, assignments still to do) as notices that lead to My Learning,
 * where they live; the six AI activities, sized so all six sit above the
 * fold on a 1366×768 classroom laptop; the next idea after the first
 * sorter; then the two routes deeper in — AI worlds and Coding Lab — each
 * with the child's progress. A brand-new child is greeted by the first-run
 * welcome, whose main button opens Train a Sorter.
 */
export default async function ExplorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");
  const snapshot = await getMyStudentSnapshot(ctx);
  // The cards are adventure levels: same school switch as the map.
  if (!isFeatureEnabled(snapshot?.school.features, "adventure")) {
    redirect({ href: "/home", locale });
  }
  const [adventure, assignments, unreadMessages, t] = await Promise.all([
    computeAdventureState(ctx),
    listMyStudentAssignments(ctx),
    getMyUnreadFeedbackCount(ctx),
    getTranslations("student.explore"),
  ]);
  const state = await getExploreState(ctx, adventure);
  const routes = routeProgress(adventure);
  const notices = landingNotices(unreadMessages, assignments);
  const first = state.cards.find((card) => card.slug === FIRST_ACTIVITY && card.state !== "LOCKED");
  // Brand new: nothing finished anywhere yet.
  const fresh = adventure.worlds.every((world) => world.completedLevels === 0);

  return (
    <AiSurface className="flex flex-col gap-5">
      <MusicScene track="map" />
      <ExploreWelcome show={fresh} userId={ctx.userId} firstActivityHref={first ? `/play/${first.levelId}` : null} />

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BunnyMascot state="pointing" size="sm" className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">{t("kicker")}</p>
          <h1 className="font-display text-2xl font-bold text-ink">{t("title")}</h1>
          <p className="text-sm text-ink-muted">{t("body")}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {state.cards.length > 0 ? (
            <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-bold text-ink-muted">
              {t("progress", { done: state.completed, total: state.cards.length })}
            </span>
          ) : null}
          <AiModeSwitch
            mode={aiModeFor(snapshot?.grade, snapshot?.aiMode)}
            gradeMode={aiModeFor(snapshot?.grade, null)}
            choice={choiceOf(snapshot?.aiMode)}
          />
        </div>
      </header>
      <div aria-hidden="true" className="bb-ai-rule" />

      {notices ? (
        <section
          aria-label={t("notices.open")}
          className="flex flex-col gap-2 rounded-2xl border-2 border-info/40 bg-info/10 px-4 py-3 sm:flex-row sm:items-center"
        >
          <ul className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            {notices.messages > 0 ? (
              <li>
                <span aria-hidden="true">💬 </span>
                {t("notices.messages", { count: notices.messages })}
              </li>
            ) : null}
            {notices.toDo > 0 ? (
              <li>
                <span aria-hidden="true">📋 </span>
                {t("notices.assignments", { count: notices.toDo })}
              </li>
            ) : null}
          </ul>
          <Link
            href="/home"
            className="inline-flex h-11 w-fit items-center rounded-lg bg-surface-raised px-4 text-sm font-semibold text-brand shadow-soft underline-offset-4 hover:underline"
          >
            {t("notices.open")}
          </Link>
        </section>
      ) : null}

      {/* The teacher's launch: one activity pinned for today. */}
      {state.launched ? (
        <section
          aria-labelledby="explore-today"
          data-testid="todays-activity"
          className="flex flex-col gap-2 rounded-2xl border-2 border-brand/40 bg-brand/10 px-4 py-3 sm:flex-row sm:items-center"
        >
          <span aria-hidden="true" className="text-2xl">
            {state.launched.glyph}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 id="explore-today" className="text-xs font-bold uppercase tracking-wide text-brand">
              {t("today.heading")}
            </h2>
            <p className="font-display text-lg font-bold text-ink">{resolveText(state.launched.title, locale)}</p>
          </div>
          <Link
            href={`/play/${state.launched.levelId}`}
            className="inline-flex h-11 w-fit items-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-strong"
          >
            {state.launched.state === "COMPLETED" ? t("today.again") : t("today.start")}
          </Link>
        </section>
      ) : null}

      {state.cards.length === 0 ? (
        <EmptyState icon={<BunnyMascot state="sleeping" size="sm" />} title={t("kicker")} description={t("body")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="explore-cards">
          {state.cards.map((card, index) => (
            <ExploreTile key={card.slug} tile={toTile(card, t, locale)} index={index} compact />
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {state.followUp ? (
          <section aria-labelledby="explore-next" className="flex flex-col gap-2">
            <h2 id="explore-next" className="font-display text-lg font-bold text-ink">
              {t("followUpTitle")}
            </h2>
            <ul className="grid flex-1 gap-3">
              <ExploreTile
                tile={toTile(
                  state.followUp,
                  t,
                  locale,
                  state.followUpAfter ? resolveText(state.followUpAfter, locale) : undefined,
                )}
                index={state.cards.length}
                compact
              />
            </ul>
            {state.alsoOpen.length > 0 ? (
              <>
                <h3 className="text-sm font-bold text-ink-muted">{t("alsoOpenTitle")}</h3>
                <ul className="grid gap-3">
                  {state.alsoOpen.map((card, index) => (
                    <ExploreTile key={card.slug} tile={toTile(card, t, locale)} index={state.cards.length + 1 + index} compact />
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}

        <section
          aria-labelledby="explore-routes"
          className={state.followUp ? "flex flex-col gap-2 lg:col-span-2" : "flex flex-col gap-2 lg:col-span-3"}
        >
          <h2 id="explore-routes" className="font-display text-lg font-bold text-ink">
            {t("routes.title")}
          </h2>
          <ul className="grid flex-1 gap-4 sm:grid-cols-2">
            <RouteCard
              href="/ai-worlds"
              glyph="🧠"
              title={t("routes.aiTitle")}
              body={t("routes.aiBody")}
              idea={t("ai")}
              cta={t("routes.aiCta")}
              progress={routes.ai}
              progressLabel={t("routes.progress", { ...routes.ai })}
              tone="ai"
            />
            <RouteCard
              href="/adventure"
              glyph="</>"
              title={t("routes.codingTitle")}
              body={t("routes.codingBody")}
              idea={t("coding")}
              cta={t("routes.codingCta")}
              progress={routes.coding}
              progressLabel={t("routes.progress", { ...routes.coding })}
              tone="coding"
            />
          </ul>
        </section>
      </div>
    </AiSurface>
  );
}
