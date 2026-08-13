import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  computeAdventureState,
  type AdventureWorldNode,
} from "@/modules/learning/server/adventure";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { BunnyMascot, CountUp, EmptyState } from "@/ui";

import { themeEmoji } from "../adventure/_components/theme";
import { WorldCard, type WorldCardVM } from "./_components/WorldCard";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function StudentHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");
  const [snapshot, t] = await Promise.all([
    getMyStudentSnapshot(ctx),
    getTranslations("student.home"),
  ]);
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

  const worldCards: WorldCardVM[] = playableWorlds.map(
    (w: AdventureWorldNode) => ({
      id: w.id,
      name: resolveText(w.name, locale),
      theme: w.theme,
      emoji: themeEmoji(w.theme),
      completedLevels: w.completedLevels,
      totalLevels: w.totalLevels,
      locked: w.state === "LOCKED",
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Row 1: hero + progress panels ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* Hero — "pick up where you left off" */}
        <section className="bb-cascade relative overflow-hidden rounded-2xl border border-border-token bg-gradient-to-br from-brand/15 via-accent/10 to-surface-raised p-6 sm:p-8">
          {/* Decorative mascot, hidden from AT and from narrow screens where
              it would crowd the copy. */}
          <BunnyMascot
            state="waving"
            size="lg"
            className="pointer-events-none absolute -bottom-2 end-4 hidden opacity-95 sm:block"
          />

          <div className="relative flex max-w-md flex-col items-start gap-3">
            <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-bold tracking-wide text-on-brand">
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
                  href="/adventure"
                  className="bb-pop inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-surface-raised shadow-soft"
                >
                  <span aria-hidden="true">▶</span>
                  {fresh ? t("heroCtaFresh") : t("heroCta")}
                </Link>
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
            className="bb-cascade rounded-2xl bg-brand-strong p-5 text-on-brand shadow-soft"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <h2 className="font-display text-base font-bold">
              {t("xpPanelTitle")}
            </h2>
            <p className="mt-0.5 text-xs opacity-80">{t("xpPanelBody")}</p>
            <p className="mt-4 font-display text-3xl font-bold tabular-nums">
              <CountUp value={snapshot?.xpTotal ?? 0} />
              <span className="ms-1 text-base font-bold opacity-80">XP</span>
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
              <span
                aria-hidden="true"
                className="bb-flame grid size-9 place-items-center rounded-xl bg-accent/20 text-lg"
              >
                🔥
              </span>
              <p className="mt-3 font-display text-2xl font-bold tabular-nums text-ink">
                <CountUp value={snapshot?.streakCurrent ?? 0} />
              </p>
              <p className="text-xs text-ink-muted">{t("streak")}</p>
            </section>
          </div>
        </div>
      </div>

      {/* ── Row 2: the roadmap grid ───────────────────────────────────── */}
      {adventureEnabled && worldCards.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              {t("roadmapTitle")}
            </h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface-sunken px-3 py-1 text-[11px] font-bold text-ink-muted">
                {t("roadmapWorlds", { count: worldCards.length })}
              </span>
              <span className="rounded-full bg-surface-sunken px-3 py-1 text-[11px] font-bold text-ink-muted">
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
