import "server-only";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import type { LocalizedText } from "@/modules/curriculum/schemas";
import {
  computeAdventureState,
  type AdventureLevelNode,
  type AdventureState,
  type AdventureWorldNode,
} from "@/modules/learning/server/adventure";

import { EXPLORE_CARDS, EXPLORE_FOLLOW_UPS, type ExploreCard, type ExploreConcept } from "../catalog";

/**
 * The Explore AI hub's data: each card resolved against THIS child's
 * programme and progress. A card whose level isn't in their programme (or
 * isn't published) is simply left out — never a dead link.
 */

export interface ExploreCardView {
  slug: string;
  concept: ExploreConcept;
  glyph: string;
  levelId: string;
  title: LocalizedText;
  worldName: LocalizedText;
  worldTheme: string;
  state: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";
  stars: number;
  maxStars: number;
  estimatedMinutes: number;
  /** Answered the "explain it" check correctly. */
  explained: boolean;
}

export interface ExploreState {
  cards: ExploreCardView[];
  /** The first follow-up not yet finished (the last one once all are). */
  followUp: ExploreCardView | null;
  /** The level that opens `followUp` when it's still locked, to name it. */
  followUpAfter: LocalizedText | null;
  completed: number;
}

function buildExploreState(adventure: AdventureState, explainedLevelIds: ReadonlySet<string>): ExploreState {
  const bySlug = new Map<string, { level: AdventureLevelNode; world: AdventureWorldNode }>();
  for (const world of adventure.worlds) {
    if (world.horizon) continue;
    for (const moduleNode of world.modules) {
      for (const level of moduleNode.levels) bySlug.set(level.slug, { level, world });
    }
  }
  const view = (card: ExploreCard): ExploreCardView | null => {
    const found = bySlug.get(card.slug);
    if (!found) return null;
    const { level, world } = found;
    return {
      slug: card.slug,
      concept: card.concept,
      glyph: card.glyph,
      levelId: level.id,
      title: level.title,
      worldName: world.name,
      worldTheme: world.theme,
      state: level.state,
      stars: level.stars,
      maxStars: level.maxStars,
      estimatedMinutes: level.estimatedMinutes,
      explained: explainedLevelIds.has(level.id),
    };
  };
  const cards = EXPLORE_CARDS.map(view).filter((card): card is ExploreCardView => card !== null);
  const chain = EXPLORE_FOLLOW_UPS.map(view).filter((card): card is ExploreCardView => card !== null);
  const index = chain.findIndex((card) => card.state !== "COMPLETED");
  const at = index === -1 ? chain.length - 1 : index;
  const followUp = chain[at] ?? null;
  // Before the chain's first step comes the hub's first card.
  const previous = at > 0 ? chain[at - 1] : cards[0];
  return {
    cards,
    followUp,
    followUpAfter: followUp?.state === "LOCKED" && previous ? previous.title : null,
    completed: cards.filter((card) => card.state === "COMPLETED").length,
  };
}

async function explainedLevelIds(ctx: SessionContext): Promise<Set<string>> {
  if (ctx.role !== "STUDENT" || !ctx.schoolId) return new Set();
  const rows = await db.conceptCheck.findMany({
    where: { studentUserId: ctx.userId, schoolId: ctx.schoolId, correctAt: { not: null } },
    select: { levelId: true },
  });
  return new Set(rows.map((row) => row.levelId));
}

/** The hub for the signed-in child. Empty for anyone who isn't a student. */
export async function getExploreState(ctx: SessionContext, adventure?: AdventureState): Promise<ExploreState> {
  if (ctx.role !== "STUDENT" || !ctx.schoolId) return { cards: [], followUp: null, followUpAfter: null, completed: 0 };
  const [state, explained] = await Promise.all([
    adventure ? Promise.resolve(adventure) : computeAdventureState(ctx),
    explainedLevelIds(ctx),
  ]);
  return buildExploreState(state, explained);
}

export const tenantScopedQueries = {
  getExploreState,
} as const;
