import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link, redirect } from "@/i18n/navigation";
import { MusicScene } from "@/modules/audio/scene";
import { requireRole } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import { getExploreState } from "@/modules/explore/server/queries";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { BunnyMascot, EmptyState } from "@/ui";

import { ExploreTile } from "./_components/ExploreTile";
import { toTile } from "./_components/to-tiles";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Explore AI (redesign brief 2026-09-25): six hands-on AI activities a child
 * can open from their very first session, with no coding before them, and
 * the rule-versus-learning bridge that follows the first one. Each card is
 * an existing level, opened from day one by the unlock engine.
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
  const [state, t] = await Promise.all([getExploreState(ctx), getTranslations("student.explore")]);
  const sorter = state.cards.find((card) => card.slug === "berry-sorter");

  return (
    <div className="flex flex-col gap-8">
      <MusicScene track="map" />

      <section className="bb-cascade relative overflow-hidden rounded-2xl bg-surface-raised p-6 shadow-raised sm:p-8">
        <BunnyMascot
          state="pointing"
          size="lg"
          className="pointer-events-none absolute -bottom-2 end-4 hidden opacity-95 sm:block"
        />
        <div className="relative flex max-w-xl flex-col items-start gap-3 sm:pe-32">
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-wide text-on-brand">
            {t("kicker")}
          </span>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t("title")}</h1>
          <p className="text-sm text-ink-muted">{t("body")}</p>
          {state.cards.length > 0 ? (
            <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-bold text-ink-muted">
              {t("progress", { done: state.completed, total: state.cards.length })}
            </span>
          ) : null}
        </div>
      </section>

      {state.cards.length === 0 ? (
        <EmptyState icon={<BunnyMascot state="sleeping" size="sm" />} title={t("kicker")} description={t("body")} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {state.cards.map((card, index) => (
            <ExploreTile key={card.slug} tile={toTile(card, t, locale)} index={index} />
          ))}
        </ul>
      )}

      {state.followUp ? (
        <section aria-labelledby="explore-next" className="flex flex-col gap-3">
          <h2 id="explore-next" className="font-display text-lg font-bold text-ink">
            {t("followUpTitle")}
          </h2>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <ExploreTile
              tile={toTile(
                state.followUp,
                t,
                locale,
                state.followUp.state === "LOCKED" && sorter ? resolveText(sorter.title, locale) : undefined,
              )}
              index={state.cards.length}
            />
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="explore-two-ways"
        className="flex flex-col gap-3 rounded-2xl border border-border-token bg-surface-raised p-5 shadow-soft sm:p-6"
      >
        <h2 id="explore-two-ways" className="font-display text-lg font-bold text-ink">
          {t("twoWaysTitle")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="flex items-start gap-3 rounded-xl bg-surface-sunken p-4 text-sm text-ink">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-white font-mono text-sm font-bold">
              {"</>"}
            </span>
            {t("coding")}
          </li>
          <li className="flex items-start gap-3 rounded-xl bg-surface-sunken p-4 text-sm text-ink">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-lg">
              🧠
            </span>
            {t("ai")}
          </li>
        </ul>
        <Link
          href="/adventure"
          className="w-fit text-sm font-semibold text-brand underline-offset-4 hover:underline"
        >
          {t("codingLink")}{" "}
          <span aria-hidden="true" className="rtl:hidden">
            →
          </span>
          <span aria-hidden="true" className="hidden rtl:inline">
            ←
          </span>
        </Link>
      </section>
    </div>
  );
}
