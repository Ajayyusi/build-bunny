import "server-only";

import type { AssignmentTarget } from "@prisma/client";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";

/**
 * Assignment listing queries (m4 deliverable 6), tenant-scoped like every
 * other domain: TEACHER sees only assignments on classes they teach;
 * SCHOOL_ADMIN may read any class's assignments in their own school.
 */

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

function asText(value: unknown, fallback: string): LocalizedText {
  const parsed = localizedText.safeParse(value);
  return parsed.success ? parsed.data : { en: fallback };
}

export interface AssignmentSummary {
  id: string;
  classId: string;
  className: string;
  target: AssignmentTarget;
  worldId: string | null;
  moduleId: string | null;
  levelId: string | null;
  targetLabel: LocalizedText;
  title: string;
  note: string | null;
  dueAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  createdByName: string;
}

interface RawAssignmentRow {
  id: string;
  target: AssignmentTarget;
  worldId: string | null;
  moduleId: string | null;
  levelId: string | null;
  title: string;
  note: string | null;
  dueAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  class: { id: string; name: string };
  createdBy: { displayName: string };
}

async function resolveTargetLabel(row: RawAssignmentRow): Promise<LocalizedText> {
  if (row.target === "LEVEL" && row.levelId) {
    const level = await db.level.findUnique({ where: { id: row.levelId }, select: { title: true, slug: true } });
    return level ? asText(level.title, level.slug) : { en: "(removed level)" };
  }
  if (row.target === "MODULE" && row.moduleId) {
    const mod = await db.module.findUnique({ where: { id: row.moduleId }, select: { name: true, slug: true } });
    return mod ? asText(mod.name, mod.slug) : { en: "(removed module)" };
  }
  if (row.target === "WORLD" && row.worldId) {
    const world = await db.world.findUnique({ where: { id: row.worldId }, select: { name: true, slug: true } });
    return world ? asText(world.name, world.slug) : { en: "(removed world)" };
  }
  return { en: "(unknown)" };
}

async function toSummaries(rows: RawAssignmentRow[]): Promise<AssignmentSummary[]> {
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      classId: row.class.id,
      className: row.class.name,
      target: row.target,
      worldId: row.worldId,
      moduleId: row.moduleId,
      levelId: row.levelId,
      targetLabel: await resolveTargetLabel(row),
      title: row.title,
      note: row.note,
      dueAt: row.dueAt,
      closedAt: row.closedAt,
      createdAt: row.createdAt,
      createdByName: row.createdBy.displayName,
    })),
  );
}

const ROW_SELECT = {
  id: true,
  target: true,
  worldId: true,
  moduleId: true,
  levelId: true,
  title: true,
  note: true,
  dueAt: true,
  closedAt: true,
  createdAt: true,
  class: { select: { id: true, name: true } },
  createdBy: { select: { displayName: true } },
} as const;

/** Every assignment across classes the calling teacher actually teaches. */
export async function listMyAssignments(ctx: SessionContext): Promise<AssignmentSummary[]> {
  const schoolId = requireSchool(ctx);
  const rows = await db.assignment.findMany({
    where: {
      schoolId,
      class: { memberships: { some: { userId: ctx.userId, role: "TEACHER", schoolId } } },
    },
    orderBy: { createdAt: "desc" },
    select: ROW_SELECT,
  });
  return toSummaries(rows);
}

/** One class's assignments — own class for a TEACHER, any class for SCHOOL_ADMIN. */
export async function listClassAssignments(
  ctx: SessionContext,
  classId: string,
): Promise<AssignmentSummary[]> {
  const schoolId = requireSchool(ctx);
  const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!cls) return [];

  if (ctx.role === "TEACHER") {
    const membership = await db.classMembership.findFirst({
      where: { classId, schoolId, userId: ctx.userId, role: "TEACHER" },
      select: { id: true },
    });
    if (!membership) return [];
  } else if (ctx.role !== "SCHOOL_ADMIN") {
    return [];
  }

  const rows = await db.assignment.findMany({
    where: { schoolId, classId },
    orderBy: { createdAt: "desc" },
    select: ROW_SELECT,
  });
  return toSummaries(rows);
}

export interface AssignableLevel {
  id: string;
  slug: string;
  title: LocalizedText;
}

export interface AssignableModule {
  id: string;
  slug: string;
  name: LocalizedText;
  levels: AssignableLevel[];
}

export interface AssignableWorld {
  id: string;
  slug: string;
  name: LocalizedText;
  modules: AssignableModule[];
}

/**
 * The published content tree of every program enabled for the caller's
 * school — feeds the assignment dialog's world/module/level picker. Content
 * itself is platform-global; the tenant-scoped part is WHICH programs a
 * school has enabled.
 */
export async function listAssignableContent(
  ctx: SessionContext,
): Promise<{ worlds: AssignableWorld[] }> {
  const schoolId = requireSchool(ctx);
  const enabled = await db.schoolProgram.findMany({
    where: { schoolId },
    select: { programId: true },
  });
  if (enabled.length === 0) return { worlds: [] };

  const programWorlds = await db.programWorld.findMany({
    where: {
      programId: { in: enabled.map((e) => e.programId) },
      world: { status: "PUBLISHED", horizon: false },
    },
    orderBy: [{ programId: "asc" }, { order: "asc" }],
    select: {
      world: {
        select: {
          id: true,
          slug: true,
          name: true,
          modules: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              slug: true,
              name: true,
              levels: {
                where: { status: "PUBLISHED", publishedVersionId: { not: null } },
                orderBy: { order: "asc" },
                select: { id: true, slug: true, title: true },
              },
            },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const worlds: AssignableWorld[] = [];
  for (const { world } of programWorlds) {
    if (seen.has(world.id)) continue;
    seen.add(world.id);
    worlds.push({
      id: world.id,
      slug: world.slug,
      name: asText(world.name, world.slug),
      modules: world.modules.map((mod) => ({
        id: mod.id,
        slug: mod.slug,
        name: asText(mod.name, mod.slug),
        levels: mod.levels.map((level) => ({
          id: level.id,
          slug: level.slug,
          title: asText(level.title, level.slug),
        })),
      })),
    });
  }
  return { worlds };
}

/** Registry walked by the tenant-isolation test suite. */
export const tenantScopedQueries = {
  listMyAssignments,
  listClassAssignments,
  listAssignableContent,
} as const;
