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

import { EXPLORE_ALSO_OPEN, EXPLORE_CARDS, EXPLORE_FOLLOW_UPS, type ExploreCard, type ExploreConcept } from "../catalog";
import { settingsForChild, type ChildExploreSettings } from "../launch";

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
  /** Open from day one besides the six cards (The Berry That Lied). */
  alsoOpen: ExploreCardView[];
  completed: number;
  /** The teacher's "Today's AI activity", pinned at the top (launch control). */
  launched: ExploreCardView | null;
}

const NO_SETTINGS: ChildExploreSettings = { hidden: new Set(), launched: null };

function buildExploreState(
  adventure: AdventureState,
  explainedLevelIds: ReadonlySet<string>,
  settings: ChildExploreSettings = NO_SETTINGS,
): ExploreState {
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
  // A card the child's teachers switched off leaves the page (the level
  // itself stays open in the AI worlds).
  const cards = EXPLORE_CARDS.filter((card) => !settings.hidden.has(card.slug))
    .map(view)
    .filter((card): card is ExploreCardView => card !== null);
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
    alsoOpen: EXPLORE_ALSO_OPEN.map(view).filter((card): card is ExploreCardView => card !== null),
    completed: cards.filter((card) => card.state === "COMPLETED").length,
    launched: cards.find((card) => card.slug === settings.launched?.slug) ?? null,
  };
}

/** The launch-control settings from every class this child is in. */
async function childSettings(ctx: SessionContext): Promise<ChildExploreSettings> {
  if (ctx.role !== "STUDENT" || !ctx.schoolId) return NO_SETTINGS;
  const memberships = await db.classMembership.findMany({
    where: { schoolId: ctx.schoolId, userId: ctx.userId, role: "STUDENT" },
    select: { classId: true },
  });
  const classIds = memberships.map((row) => row.classId);
  if (classIds.length === 0) return NO_SETTINGS;
  const rows = await db.classExploreActivity.findMany({
    where: { schoolId: ctx.schoolId, classId: { in: classIds } },
    select: { classId: true, slug: true, hidden: true, launchedAt: true },
  });
  return settingsForChild(classIds, rows);
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
  if (ctx.role !== "STUDENT" || !ctx.schoolId) {
    return { cards: [], followUp: null, followUpAfter: null, alsoOpen: [], completed: 0, launched: null };
  }
  const [state, explained, settings] = await Promise.all([
    adventure ? Promise.resolve(adventure) : computeAdventureState(ctx),
    explainedLevelIds(ctx),
    childSettings(ctx),
  ]);
  return buildExploreState(state, explained, settings);
}

export interface ClassExploreActivityView {
  slug: string;
  concept: ExploreConcept;
  glyph: string;
  /** The level's title, when it is published. */
  title: LocalizedText | null;
  open: boolean;
  launched: boolean;
}

/**
 * Launch control on a class page: the six Explore AI activities and how
 * this class has them. Null when the class is out of scope (another school,
 * or another teacher's class). `canManage`: only the class's own teacher
 * changes them; a school admin sees them.
 */
export async function getClassExploreSettings(
  ctx: SessionContext,
  classId: string,
): Promise<{ canManage: boolean; activities: ClassExploreActivityView[] } | null> {
  const schoolId = ctx.schoolId;
  if (!schoolId || (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN")) return null;
  const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!cls) return null;
  if (ctx.role === "TEACHER") {
    const membership = await db.classMembership.findFirst({
      where: { classId, schoolId, userId: ctx.userId, role: "TEACHER" },
      select: { id: true },
    });
    if (!membership) return null;
  }
  const slugs = EXPLORE_CARDS.map((card) => card.slug);
  const [rows, levels] = await Promise.all([
    db.classExploreActivity.findMany({
      where: { schoolId, classId },
      select: { slug: true, hidden: true, launchedAt: true },
    }),
    db.level.findMany({ where: { slug: { in: slugs }, status: "PUBLISHED" }, select: { slug: true, title: true } }),
  ]);
  return {
    canManage: ctx.role === "TEACHER",
    activities: EXPLORE_CARDS.map((card) => {
      const row = rows.find((r) => r.slug === card.slug);
      const level = levels.find((l) => l.slug === card.slug);
      return {
        slug: card.slug,
        concept: card.concept,
        glyph: card.glyph,
        title: level ? (level.title as LocalizedText) : null,
        open: !row?.hidden,
        launched: Boolean(row?.launchedAt),
      };
    }),
  };
}

export const tenantScopedQueries = {
  getExploreState,
  getClassExploreSettings,
} as const;
