import "server-only";

import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/modules/auth/server/guard";

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

/** Strict form used at creation time: an empty or unresolvable scope throws. */
export async function resolveAssignmentLevelIds(scope: AssignmentScope): Promise<string[]> {
  if (scope.target === "LEVEL") {
    if (!scope.levelId) throw new ConflictError("LEVEL target requires levelId");
    const level = await db.level.findFirst({ where: { id: scope.levelId, ...PUBLISHED } });
    if (!level) throw new NotFoundError("Level not found or not published");
    return [level.id];
  }
  if (scope.target === "MODULE") {
    if (!scope.moduleId) throw new ConflictError("MODULE target requires moduleId");
    const levels = await db.level.findMany({
      where: { moduleId: scope.moduleId, ...PUBLISHED },
      select: { id: true },
    });
    if (levels.length === 0) throw new NotFoundError("Module has no published levels");
    return levels.map((level) => level.id);
  }
  if (!scope.worldId) throw new ConflictError("WORLD target requires worldId");
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
): Promise<string[]> {
  try {
    return await resolveAssignmentLevelIds(scope);
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
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (assignments.length === 0) return out;

  const levelIds = assignments.filter((a) => a.target === "LEVEL").map((a) => a.levelId ?? "");
  const moduleIds = assignments.filter((a) => a.target === "MODULE").map((a) => a.moduleId ?? "");
  const worldIds = assignments.filter((a) => a.target === "WORLD").map((a) => a.worldId ?? "");

  const [levels, moduleLevels, worldLevels] = await Promise.all([
    levelIds.length
      ? db.level.findMany({ where: { id: { in: levelIds }, ...PUBLISHED }, select: { id: true } })
      : Promise.resolve([]),
    moduleIds.length
      ? db.level.findMany({
          where: { moduleId: { in: moduleIds }, ...PUBLISHED },
          select: { id: true, moduleId: true },
        })
      : Promise.resolve([]),
    worldIds.length
      ? db.level.findMany({
          where: { module: { worldId: { in: worldIds } }, ...PUBLISHED },
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
