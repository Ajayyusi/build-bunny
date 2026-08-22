import "server-only";

import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/modules/auth/server/guard";
import { entitledWorldIds } from "@/modules/curriculum/server/entitlement";

/**
 * Which published levels an assignment covers.
 *
 * Shared by creation (which force-unlocks exactly this set) and by progress
 * (which asks how much of exactly this set a student has finished). One
 * definition on purpose: if the two ever disagreed, a student could be
 * assigned levels that never count toward "done", or shown a completion bar
 * that never fills.
 *
 * Only PUBLISHED levels count. A draft level inside an assigned world is not
 * something a child can play, so including it would make the assignment
 * permanently incompletable.
 */

export interface AssignmentScope {
  target: "WORLD" | "MODULE" | "LEVEL";
  worldId?: string | null;
  moduleId?: string | null;
  levelId?: string | null;
}

const PUBLISHED = { status: "PUBLISHED" as const, publishedVersionId: { not: null } };

/**
 * Strict form used at creation time: an empty or unresolvable scope throws.
 *
 * Scoped to the school's entitlement, not merely to published content. A
 * teacher request naming a level from a programme the school does not have
 * is rejected here, BEFORE createAssignmentCore writes progress rows for it
 * — those rows were previously the only thing the submit and hint paths
 * checked, so letting one be created handed out authorization as a side
 * effect of an unauthorized request.
 */
export async function resolveAssignmentLevelIds(
  scope: AssignmentScope,
  schoolId: string,
): Promise<string[]> {
  const worldIds = await entitledWorldIds(schoolId);
  if (worldIds.length === 0) {
    throw new NotFoundError("This school has no published programme");
  }
  const withinEntitlement = { module: { worldId: { in: worldIds } } };

  if (scope.target === "LEVEL") {
    if (!scope.levelId) throw new ConflictError("LEVEL target requires levelId");
    const level = await db.level.findFirst({
      where: { id: scope.levelId, ...PUBLISHED, ...withinEntitlement },
    });
    if (!level) throw new NotFoundError("Level not found or not published");
    return [level.id];
  }
  if (scope.target === "MODULE") {
    if (!scope.moduleId) throw new ConflictError("MODULE target requires moduleId");
    const levels = await db.level.findMany({
      where: { moduleId: scope.moduleId, ...PUBLISHED, ...withinEntitlement },
      select: { id: true },
    });
    if (levels.length === 0) throw new NotFoundError("Module has no published levels");
    return levels.map((level) => level.id);
  }
  if (!scope.worldId) throw new ConflictError("WORLD target requires worldId");
  if (!worldIds.includes(scope.worldId)) {
    throw new NotFoundError("World not found in this school's programme");
  }
  const levels = await db.level.findMany({
    where: { module: { worldId: scope.worldId }, ...PUBLISHED },
    select: { id: true },
  });
  if (levels.length === 0) throw new NotFoundError("World has no published levels");
  return levels.map((level) => level.id);
}

/**
 * Read-side form: resolves the same set for assignments that already exist,
 * returning [] instead of throwing. An assignment whose content was later
 * archived must render as "nothing to do" on a child's home screen, not blow
 * the page up.
 */
export async function resolveExistingAssignmentLevelIds(
  scope: AssignmentScope,
  schoolId: string,
): Promise<string[]> {
  try {
    return await resolveAssignmentLevelIds(scope, schoolId);
  } catch {
    return [];
  }
}

/**
 * Level ids for many assignments at once, keyed by assignment id.
 *
 * Batched because both call sites render a LIST — a student's home screen
 * and a teacher's assignment table — and resolving per row would issue a
 * query per assignment on every page load.
 */
export async function resolveLevelIdsForAssignments(
  assignments: (AssignmentScope & { id: string })[],
  schoolId: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (assignments.length === 0) return out;

  // Entitlement is re-checked on read, not just at creation: a school whose
  // programme is later changed or removed must stop resolving assignments
  // for content it no longer has, rather than keeping them alive because
  // they were legitimate when they were made.
  const entitledWorlds = await entitledWorldIds(schoolId);
  if (entitledWorlds.length === 0) {
    for (const assignment of assignments) out.set(assignment.id, []);
    return out;
  }
  const withinEntitlement = { module: { worldId: { in: entitledWorlds } } };

  const levelIds = assignments.filter((a) => a.target === "LEVEL").map((a) => a.levelId ?? "");
  const moduleIds = assignments.filter((a) => a.target === "MODULE").map((a) => a.moduleId ?? "");
  const worldIds = assignments.filter((a) => a.target === "WORLD").map((a) => a.worldId ?? "");

  const [levels, moduleLevels, worldLevels] = await Promise.all([
    levelIds.length
      ? db.level.findMany({
          where: { id: { in: levelIds }, ...PUBLISHED, ...withinEntitlement },
          select: { id: true },
        })
      : Promise.resolve([]),
    moduleIds.length
      ? db.level.findMany({
          where: { moduleId: { in: moduleIds }, ...PUBLISHED, ...withinEntitlement },
          select: { id: true, moduleId: true },
        })
      : Promise.resolve([]),
    worldIds.length
      ? db.level.findMany({
          where: {
            module: { worldId: { in: worldIds.filter((id) => entitledWorlds.includes(id)) } },
            ...PUBLISHED,
          },
          select: { id: true, module: { select: { worldId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const publishedLevelIds = new Set(levels.map((level) => level.id));
  const byModule = new Map<string, string[]>();
  for (const level of moduleLevels) {
    byModule.set(level.moduleId, [...(byModule.get(level.moduleId) ?? []), level.id]);
  }
  const byWorld = new Map<string, string[]>();
  for (const level of worldLevels) {
    const worldId = level.module.worldId;
    byWorld.set(worldId, [...(byWorld.get(worldId) ?? []), level.id]);
  }

  for (const assignment of assignments) {
    if (assignment.target === "LEVEL") {
      const id = assignment.levelId ?? "";
      out.set(assignment.id, publishedLevelIds.has(id) ? [id] : []);
    } else if (assignment.target === "MODULE") {
      out.set(assignment.id, byModule.get(assignment.moduleId ?? "") ?? []);
    } else {
      out.set(assignment.id, byWorld.get(assignment.worldId ?? "") ?? []);
    }
  }
  return out;
}
