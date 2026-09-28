import "server-only";

import { lessonKindOf } from "@/modules/explore/catalog";

import { ageBandFor } from "@/modules/learning/age-band";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  computeAdventureState,
  getLevelIntros,
  type AdventureState,
  type AdventureWorldNode,
} from "@/modules/learning/server/adventure";
import type { SessionContext } from "@/modules/auth/server/session";

import type { HorizonWorldVM, TrailIntroVM, TrailLevelVM, TrailWorldVM } from "./types";

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

  // One batched read for the whole map. Per-level calls cost six queries
  // each, so a child with twenty levels open paid over a hundred on the page
  // they open most. Anything the student may not see is simply absent from
  // the result, exactly as the single-level form returned null.
  const intros = await getLevelIntros(
    ctx,
    openable.map((level) => level.id),
  );

  return new Map(
    [...intros].map(([levelId, intro]) => [
      levelId,
      {
        title: resolveText(intro.title, locale),
        story: resolveText(intro.story, locale),
        // The child-facing mission when authored; the teacher-facing
        // objective otherwise.
        objective: resolveText(intro.mission ?? intro.objective, locale),
        instructions: resolveText(intro.instructions, locale),
        difficulty: intro.difficulty,
        estimatedMinutes: intro.estimatedMinutes,
        ageBand: ageBandFor(intro.recommendedGradeMin),
        lessonKind: lessonKindOf(intro),
        stars: intro.stars,
        maxStars: intro.maxStars,
      } satisfies TrailIntroVM,
    ]),
  );
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
                ageBand: null,
                lessonKind: lessonKindOf(level),
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
    kind: world.kind,
    completedLevels: world.completedLevels,
    totalLevels: world.totalLevels,
    starsEarned: world.starsEarned,
    totalStars: world.totalStars,
    levels,
    slug: world.slug,
    story: world.story
      ? world.story.beats.map((beat) => ({
          pose: beat.pose,
          text: resolveText(beat.text, locale),
        }))
      : null,
    character: world.character
      ? {
          name: resolveText(world.character.name, locale),
          role: resolveText(world.character.role, locale),
          glyph: world.character.glyph,
        }
      : null,
    power: world.power
      ? {
          name: resolveText(world.power.name, locale),
          idea: resolveText(world.power.idea, locale),
          glyph: world.power.glyph,
        }
      : null,
  };
}

/**
 * One route's trail (redesign brief: Explore AI and Coding Lab are separate
 * routes). The same progress and unlock state as always, filtered to the
 * worlds of one kind — so nothing is copied or migrated, and a child's
 * progress shows up on whichever route the world belongs to.
 */
export async function loadRouteTrail(
  ctx: SessionContext,
  locale: string,
  kind: "ai" | "coding",
): Promise<{ state: AdventureState; worlds: TrailWorldVM[]; horizon: HorizonWorldVM[] }> {
  const state = await computeAdventureState(ctx);
  const routeWorlds = state.worlds.filter(
    (world: AdventureWorldNode) => !world.horizon && world.totalLevels > 0 && world.kind === kind,
  );
  const intros = await loadIntros(ctx, routeWorlds, locale);
  const horizon: HorizonWorldVM[] =
    kind === "coding"
      ? state.worlds
          .filter((world: AdventureWorldNode) => world.horizon)
          .map((world: AdventureWorldNode) => ({
            id: world.id,
            theme: world.theme,
            name: resolveText(world.name, locale),
            tagline: world.tagline ? resolveText(world.tagline, locale) : null,
          }))
      : [];
  return { state, worlds: routeWorlds.map((world) => toTrailWorld(world, locale, intros)), horizon };
}
