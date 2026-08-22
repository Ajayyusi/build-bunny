import "server-only";

import { db } from "@/lib/db";

/**
 * Which curriculum a school is actually entitled to.
 *
 * A level being PUBLISHED says it is finished content; it says nothing about
 * whether THIS school bought it. Those were conflated: assignment scope
 * accepted any globally published level, and the submit/hint/draft paths
 * treated the existence of a StudentProgress row as authorization. Since
 * assignment creation is what writes those rows, a tampered assignment
 * request minted its own authorization for content outside the school's
 * programme — the player would say "not found" while the API still graded it.
 *
 * Entitlement is therefore resolved from the school's enabled programme on
 * every path that can reach curriculum, and never inferred from a row that
 * an earlier request created.
 *
 * PUBLISHED programmes only, matching the adventure map: content a student
 * could never legitimately see must not become assignable by another route.
 */

/** World ids reachable from the school's enabled, published programmes. */
export async function entitledWorldIds(schoolId: string): Promise<string[]> {
  const enabled = await db.schoolProgram.findMany({
    where: { schoolId, program: { status: "PUBLISHED" } },
    select: { programId: true },
  });
  if (enabled.length === 0) return [];

  const worlds = await db.programWorld.findMany({
    where: { programId: { in: enabled.map((row) => row.programId) } },
    select: { worldId: true },
  });
  return worlds.map((row) => row.worldId);
}

/**
 * Is this specific level inside the school's entitlement?
 *
 * One query, and deliberately independent of progress rows, assignments and
 * unlock state — this answers "may this school touch this content at all",
 * which is a question those things must not be able to answer for it.
 */
export async function isLevelEntitled(schoolId: string, levelId: string): Promise<boolean> {
  const level = await db.level.findFirst({
    where: {
      id: levelId,
      module: {
        world: {
          programs: {
            some: { program: { status: "PUBLISHED", schoolPrograms: { some: { schoolId } } } },
          },
        },
      },
    },
    select: { id: true },
  });
  return level !== null;
}
