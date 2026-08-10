import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  computeAdventureState,
  getLevelIntro,
  type AdventureWorldNode,
} from "@/modules/learning/server/adventure";
import { requireRole, type SessionContext } from "@/modules/auth/server/session";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { EmptyState, PageHeader } from "@/ui";

import { AdventureTrail } from "./_components/AdventureTrail";
import { HorizonBand } from "./_components/HorizonBand";
import type {
  HorizonWorldVM,
  TrailIntroVM,
  TrailLevelVM,
  TrailWorldVM,
} from "./_components/types";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Fetch intros for every openable node up front (≤ a couple dozen levels in
 * a program) so the sheet opens instantly with published-snapshot text.
 * getLevelIntro returns null for anything a student may not see; those nodes
 * fall back to the map data they already carry.
 */
async function loadIntros(
  ctx: SessionContext,
  worlds: AdventureWorldNode[],
  locale: string,
): Promise<Map<string, TrailIntroVM>> {
  const openable = worlds
    .flatMap((world) => world.modules)
    .flatMap((moduleNode) => moduleNode.levels)
    .filter((level) => level.state !== "LOCKED");

  const entries = await Promise.all(
    openable.map(async (level) => {
      const intro = await getLevelIntro(ctx, level.id);
      if (!intro) return null;
      return [
        level.id,
        {
          title: resolveText(intro.title, locale),
          story: resolveText(intro.story, locale),
          objective: resolveText(intro.objective, locale),
          instructions: resolveText(intro.instructions, locale),
          difficulty: intro.difficulty,
          estimatedMinutes: intro.estimatedMinutes,
          stars: intro.stars,
          maxStars: intro.maxStars,
        } satisfies TrailIntroVM,
      ] as const;
    }),
  );

  return new Map(entries.filter((entry) => entry !== null));
}

function toTrailWorld(
  world: AdventureWorldNode,
  locale: string,
  intros: Map<string, TrailIntroVM>,
): TrailWorldVM {
  const modules = [...world.modules].sort((a, b) => a.order - b.order);
  const multiModule = modules.length > 1;
  const levels: TrailLevelVM[] = [];

  for (const moduleNode of modules) {
    const moduleLevels = [...moduleNode.levels].sort(
      (a, b) => a.order - b.order,
    );
    for (const [indexInModule, level] of moduleLevels.entries()) {
      const number = levels.length + 1;
      const title = resolveText(level.title, locale);
      levels.push({
        id: level.id,
        number,
        title,
        state: level.state,
        stars: level.stars,
        maxStars: level.maxStars,
        current: level.current,
        moduleLabel:
          multiModule && indexInModule === 0
            ? resolveText(moduleNode.name, locale)
            : null,
        intro:
          level.state === "LOCKED"
            ? null
            : (intros.get(level.id) ?? {
                title,
                story: "",
                objective: "",
                instructions: "",
                difficulty: level.difficulty,
                estimatedMinutes: level.estimatedMinutes,
                stars: level.stars,
                maxStars: level.maxStars,
              }),
        // Linear prerequisite by trail order; the first level of a world
        // points at the previous world instead.
        prereqNumber: number > 1 ? number - 1 : null,
      });
    }
  }

  return {
    id: world.id,
    theme: world.theme,
    name: resolveText(world.name, locale),
    tagline: world.tagline ? resolveText(world.tagline, locale) : null,
    state: world.state === "HORIZON" ? "LOCKED" : world.state,
    completedLevels: world.completedLevels,
    totalLevels: world.totalLevels,
    starsEarned: world.starsEarned,
    totalStars: world.totalStars,
    levels,
  };
}

export default async function AdventurePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");

  const snapshot = await getMyStudentSnapshot(ctx);
  if (!isFeatureEnabled(snapshot?.school.features, "adventure")) {
    redirect({ href: "/home", locale });
  }

  const [state, t] = await Promise.all([
    computeAdventureState(ctx),
    getTranslations("student.adventure"),
  ]);

  const activeWorlds = state.worlds.filter(
    (world: AdventureWorldNode) => !world.horizon && world.totalLevels > 0,
  );

  if (!state.program || activeWorlds.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t("title")} />
        <EmptyState
          icon={<span className="text-2xl">🗺️</span>}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      </div>
    );
  }

  const intros = await loadIntros(ctx, activeWorlds, locale);
  const trailWorlds = activeWorlds.map((world: AdventureWorldNode) =>
    toTrailWorld(world, locale, intros),
  );
  const horizonWorlds: HorizonWorldVM[] = state.worlds
    .filter((world: AdventureWorldNode) => world.horizon)
    .map((world: AdventureWorldNode) => ({
      id: world.id,
      theme: world.theme,
      name: resolveText(world.name, locale),
      tagline: world.tagline ? resolveText(world.tagline, locale) : null,
    }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("pathTitle")} description={t("pathSubtitle")} />
      <AdventureTrail worlds={trailWorlds} />
      <HorizonBand worlds={horizonWorlds} />
    </div>
  );
}
