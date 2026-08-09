import "server-only";

import type { ContentStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";
import {
  runPublishGates,
  type GateResult,
  type LevelSnapshot,
} from "@/modules/curriculum/server/publish";

/**
 * Curriculum content queries. Two kinds live here:
 *
 * 1. Platform browse queries — cross-cutting authoring views for NITAQ/SUPER
 *    admins only, guarded like schools/server/platform-queries.ts (content is
 *    platform-global, so there is no schoolId to scope by).
 * 2. Published-content readers — plain functions with no session that other
 *    modules (learning/adventure) call server-side. They only ever surface
 *    PUBLISHED snapshots, and student-facing callers must pass payloads
 *    through stripStudentPayload before shipping them to the client.
 */
function requirePlatform(ctx: SessionContext): void {
  if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "NITAQ_ADMIN") {
    throw new Error("Platform-only query invoked with a non-platform session");
  }
}

function asText(value: Prisma.JsonValue | null | undefined): LocalizedText | null {
  const parsed = localizedText.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ── Platform browse queries ───────────────────────────────────────────────

export interface CurriculumProgramSummary {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText | null;
  gradeMin: number;
  gradeMax: number;
  status: ContentStatus;
  worldCount: number;
  moduleCount: number;
  levelCount: number;
  statusRollup: Record<ContentStatus, number>;
}

export async function listCurriculumPrograms(
  ctx: SessionContext,
): Promise<CurriculumProgramSummary[]> {
  requirePlatform(ctx);
  const programs = await db.program.findMany({
    orderBy: { slug: "asc" },
    include: {
      worlds: {
        orderBy: { order: "asc" },
        include: {
          world: {
            include: {
              modules: { include: { levels: { select: { status: true } } } },
            },
          },
        },
      },
    },
  });
  return programs.map((program) => {
    const worlds = program.worlds.map((link) => link.world);
    const modules = worlds.flatMap((w) => w.modules);
    const levels = modules.flatMap((m) => m.levels);
    const statusRollup: Record<ContentStatus, number> = {
      DRAFT: 0,
      REVIEW: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };
    for (const level of levels) statusRollup[level.status] += 1;
    return {
      id: program.id,
      slug: program.slug,
      name: asText(program.name) ?? { en: program.slug },
      description: asText(program.description),
      gradeMin: program.gradeMin,
      gradeMax: program.gradeMax,
      status: program.status,
      worldCount: worlds.length,
      moduleCount: modules.length,
      levelCount: levels.length,
      statusRollup,
    };
  });
}

export interface CurriculumLevelRow {
  id: string;
  slug: string;
  order: number;
  title: LocalizedText;
  activityType: string;
  difficulty: string;
  status: ContentStatus;
  arComplete: boolean;
}

export interface CurriculumModuleNode {
  id: string;
  slug: string;
  order: number;
  name: LocalizedText;
  levels: CurriculumLevelRow[];
}

export interface CurriculumWorldNode {
  id: string;
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText | null;
  theme: string;
  status: ContentStatus;
  horizon: boolean;
  levelCount: number;
  publishedCount: number;
  arCompleteCount: number;
  modules: CurriculumModuleNode[];
}

export async function listCurriculumWorlds(
  ctx: SessionContext,
): Promise<CurriculumWorldNode[]> {
  requirePlatform(ctx);
  const worlds = await db.world.findMany({
    orderBy: { slug: "asc" },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          levels: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              slug: true,
              order: true,
              title: true,
              activityType: true,
              difficulty: true,
              status: true,
              arComplete: true,
            },
          },
        },
      },
    },
  });
  return worlds.map((world) => {
    const levels = world.modules.flatMap((m) => m.levels);
    return {
      id: world.id,
      slug: world.slug,
      name: asText(world.name) ?? { en: world.slug },
      tagline: asText(world.tagline),
      theme: world.theme,
      status: world.status,
      horizon: world.horizon,
      levelCount: levels.length,
      publishedCount: levels.filter((l) => l.status === "PUBLISHED").length,
      arCompleteCount: levels.filter((l) => l.arComplete).length,
      modules: world.modules.map((module) => ({
        id: module.id,
        slug: module.slug,
        order: module.order,
        name: asText(module.name) ?? { en: module.slug },
        levels: module.levels.map((level) => ({
          id: level.id,
          slug: level.slug,
          order: level.order,
          title: asText(level.title) ?? { en: level.slug },
          activityType: level.activityType,
          difficulty: level.difficulty,
          status: level.status,
          arComplete: level.arComplete,
        })),
      })),
    };
  });
}

export interface CurriculumLevelDetail {
  id: string;
  slug: string;
  order: number;
  activityType: string;
  track: string;
  status: ContentStatus;
  arComplete: boolean;
  difficulty: string;
  estimatedMinutes: number;
  xpReward: number | null;
  maxStars: number;
  tags: string[];
  recommendedGradeMin: number | null;
  recommendedGradeMax: number | null;
  title: LocalizedText;
  story: LocalizedText | null;
  objective: LocalizedText | null;
  instructions: LocalizedText | null;
  explanation: LocalizedText | null;
  teacherNotes: LocalizedText | null;
  /** Authoring surface: payload/hints may contain answer-bearing fields. */
  payload: unknown;
  hints: { tier: number; text: LocalizedText }[];
  module: { id: string; slug: string; name: LocalizedText };
  world: { id: string; slug: string; name: LocalizedText; status: ContentStatus };
  prerequisites: { id: string; slug: string }[];
  versions: { version: number; publishedAt: Date; publishedById: string | null }[];
  gates: GateResult[];
}

export async function getCurriculumLevelDetail(
  ctx: SessionContext,
  levelId: string,
): Promise<CurriculumLevelDetail | null> {
  requirePlatform(ctx);
  const level = await db.level.findUnique({
    where: { id: levelId },
    include: {
      module: {
        select: {
          id: true,
          slug: true,
          name: true,
          world: { select: { id: true, slug: true, name: true, status: true } },
        },
      },
      prerequisites: {
        select: { requiresLevel: { select: { id: true, slug: true } } },
      },
      versions: {
        orderBy: { version: "desc" },
        select: { version: true, publishedAt: true, publishedById: true },
      },
    },
  });
  if (!level) return null;

  const gates = await runPublishGates(levelId);
  const rawHints = Array.isArray(level.hints) ? level.hints : [];
  const hints = rawHints.flatMap((hint) => {
    if (!hint || typeof hint !== "object" || Array.isArray(hint)) return [];
    const record = hint as Record<string, unknown>;
    const text = asText(record["text"] as Prisma.JsonValue);
    const tier = typeof record["tier"] === "number" ? record["tier"] : 0;
    return text ? [{ tier, text }] : [];
  });

  return {
    id: level.id,
    slug: level.slug,
    order: level.order,
    activityType: level.activityType,
    track: level.track,
    status: level.status,
    arComplete: level.arComplete,
    difficulty: level.difficulty,
    estimatedMinutes: level.estimatedMinutes,
    xpReward: level.xpReward,
    maxStars: level.maxStars,
    tags: level.tags,
    recommendedGradeMin: level.recommendedGradeMin,
    recommendedGradeMax: level.recommendedGradeMax,
    title: asText(level.title) ?? { en: level.slug },
    story: asText(level.story),
    objective: asText(level.objective),
    instructions: asText(level.instructions),
    explanation: asText(level.explanation),
    teacherNotes: asText(level.teacherNotes),
    payload: level.payload,
    hints,
    module: {
      id: level.module.id,
      slug: level.module.slug,
      name: asText(level.module.name) ?? { en: level.module.slug },
    },
    world: {
      id: level.module.world.id,
      slug: level.module.world.slug,
      name: asText(level.module.world.name) ?? { en: level.module.world.slug },
      status: level.module.world.status,
    },
    prerequisites: level.prerequisites.map((p) => p.requiresLevel),
    versions: level.versions,
    gates,
  };
}

// ── Published-content readers (cross-module, no session) ──────────────────

export interface PublishedLevelSnapshot {
  levelId: string;
  version: number;
  publishedAt: Date;
  snapshot: LevelSnapshot;
}

/**
 * The currently-published snapshot of a level, or null when the level does
 * not exist, is not PUBLISHED (ARCHIVED hides it), or has no version yet.
 * SERVER-INTERNAL: the snapshot contains hints and answer-bearing payload
 * fields — student-facing callers must strip before sending anything down.
 */
export async function getPublishedLevelSnapshot(
  levelId: string,
): Promise<PublishedLevelSnapshot | null> {
  const level = await db.level.findUnique({
    where: { id: levelId },
    select: { id: true, status: true, publishedVersionId: true },
  });
  if (!level || level.status !== "PUBLISHED" || !level.publishedVersionId) {
    return null;
  }
  const version = await db.levelVersion.findUnique({
    where: { id: level.publishedVersionId },
  });
  if (!version) return null;
  return {
    levelId: level.id,
    version: version.version,
    publishedAt: version.publishedAt,
    snapshot: version.snapshot as unknown as LevelSnapshot,
  };
}

/** Answer-bearing payload keys that must never reach a student client. */
const ANSWER_KEYS = ["solution", "correctOptionId", "correctOrder"] as const;

/**
 * Removes answer-bearing fields from a level payload before it is shipped to
 * a student surface. Hints are stored outside the payload (server-held), so
 * they never pass through here. The activityType parameter documents intent
 * and keeps the signature stable if a future activity needs bespoke rules —
 * today every V1 type strips the same key set.
 */
export function stripStudentPayload(activityType: string, payload: unknown): unknown {
  void activityType;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const clone: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  for (const key of ANSWER_KEYS) delete clone[key];
  return clone;
}

/**
 * Registry walked by the tenant-isolation suite. Curriculum content is
 * platform-global: the browse queries are platform-guarded (they throw for
 * school-scoped sessions — asserted in the isolation suite) and the
 * published readers/strip helper never touch tenant data at all.
 */
export const tenantScopedQueries = {
  listCurriculumPrograms,
  listCurriculumWorlds,
  getCurriculumLevelDetail,
  getPublishedLevelSnapshot,
  stripStudentPayload,
} as const;
