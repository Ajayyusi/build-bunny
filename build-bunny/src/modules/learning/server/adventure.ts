import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  localizedText,
  moduleUnlockRuleSchema,
  type LocalizedText,
} from "@/modules/curriculum/schemas";

/**
 * Unlock/progress engine + adventure state (plan §M2, pinned cross-agent
 * interface — the map UI consumes these shapes verbatim, the seed calls
 * recomputeUnlocks). Semantics:
 *  - Absence of a StudentProgress row = LOCKED; recomputeUnlocks materializes
 *    UNLOCKED rows and NEVER downgrades or removes existing ones.
 *  - Linear-by-order unlocking inside a module; explicit LevelPrerequisite
 *    edges (ALL must be COMPLETED) override the linear rule for that level.
 *  - Module gate: previous module has all its published levels completed —
 *    UNLESS the module's unlockRule is {type:"OPEN"} (phase G graft), in
 *    which case every level in it unlocks immediately once the module is
 *    reachable at all (world published + in the student's program), skipping
 *    both the previous-module and previous-world gates. unlockSource "OPEN"
 *    records this on the resulting progress rows.
 *  - World gate (TIGHTENED, owner-approved M3 change): first program world,
 *    or ALL published levels of the previous non-horizon world COMPLETED.
 *  - Only PUBLISHED content is ever visible; student-facing text comes from
 *    the published LevelVersion snapshot, never from draft fields.
 */

// ── Pinned interfaces ────────────────────────────────────────────────────

export interface AdventureLevelNode {
  id: string;
  slug: string;
  title: LocalizedText;
  order: number;
  activityType: string;
  difficulty: string;
  estimatedMinutes: number;
  maxStars: number;
  state: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";
  stars: number;
  current: boolean;
}

export interface AdventureModuleNode {
  id: string;
  slug: string;
  name: LocalizedText;
  order: number;
  levels: AdventureLevelNode[];
}

export interface AdventureWorldNode {
  id: string;
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText | null;
  theme: string;
  horizon: boolean;
  state: "LOCKED" | "AVAILABLE" | "CURRENT" | "COMPLETED" | "HORIZON";
  completedLevels: number;
  totalLevels: number;
  starsEarned: number;
  totalStars: number;
  modules: AdventureModuleNode[];
}

export interface AdventureState {
  program: { id: string; slug: string; name: LocalizedText } | null;
  worlds: AdventureWorldNode[];
  currentLevelId: string | null;
}

export interface LevelIntro {
  id: string;
  slug: string;
  title: LocalizedText;
  story: LocalizedText | null;
  objective: LocalizedText | null;
  instructions: LocalizedText | null;
  difficulty: string;
  estimatedMinutes: number;
  maxStars: number;
  stars: number;
  state: "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";
  activityType: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

/**
 * Student-facing text fields of a published snapshot. Parsing through a
 * strict-shape zod object is what STRUCTURALLY strips payload/hints: unknown
 * snapshot keys never survive into query results.
 */
const snapshotTextSchema = z.object({
  title: localizedText,
  story: localizedText.nullish(),
  objective: localizedText.nullish(),
  instructions: localizedText.nullish(),
});
type SnapshotText = z.infer<typeof snapshotTextSchema>;

function parseSnapshotText(snapshot: unknown): SnapshotText | null {
  const parsed = snapshotTextSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : null;
}

function asText(value: unknown, fallback: string): LocalizedText {
  const parsed = localizedText.safeParse(value);
  return parsed.success ? parsed.data : { en: fallback };
}

function asTextOrNull(value: unknown): LocalizedText | null {
  const parsed = localizedText.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Module.unlockRule OPEN (phase G graft): true when the module should unlock
 * in full — every level, immediately — as soon as it is reachable at all
 * (its world is published and in the student's program). Any other JSON
 * shape (including null/absent) keeps the default linear +
 * explicit-prerequisite behaviour below, so nothing already deployed moves.
 */
function isOpenUnlockRule(unlockRule: unknown): boolean {
  return moduleUnlockRuleSchema.safeParse(unlockRule).success;
}

interface ResolvedProgram {
  id: string;
  slug: string;
  name: LocalizedText;
}

async function findPublishedProgram(id: string): Promise<ResolvedProgram | null> {
  const program = await db.program.findFirst({
    where: { id, status: "PUBLISHED" },
    select: { id: true, slug: true, name: true },
  });
  if (!program) return null;
  return { id: program.id, slug: program.slug, name: asText(program.name, program.slug) };
}

/**
 * Program resolution order: the student's pinned StudentProfile.programId,
 * else the school's single enabled SchoolProgram, else null (empty state).
 * A pinned/enabled program that is not PUBLISHED resolves to null — only
 * published content ever appears.
 */
async function resolveProgramForStudent(
  userId: string,
  schoolId: string,
): Promise<ResolvedProgram | null> {
  // Compound lookup: a session pointing at a profile from another school
  // resolves to nothing rather than following its program pin.
  const profile = await db.studentProfile.findFirst({
    where: { userId, schoolId },
    select: { programId: true },
  });
  return resolveProgramForSchool(schoolId, profile?.programId ?? null);
}

async function resolveProgramForSchool(
  schoolId: string,
  pinnedProgramId: string | null,
): Promise<ResolvedProgram | null> {
  if (pinnedProgramId) return findPublishedProgram(pinnedProgramId);
  // take: 2 — we only need to know whether the school has EXACTLY one.
  const enabled = await db.schoolProgram.findMany({
    where: { schoolId },
    select: { programId: true },
    take: 2,
  });
  if (enabled.length !== 1) return null;
  return findPublishedProgram(enabled[0]!.programId);
}

interface LoadedLevel {
  id: string;
  slug: string;
  order: number;
  activityType: string;
  difficulty: string;
  estimatedMinutes: number;
  maxStars: number;
  publishedVersionId: string;
  prereqIds: string[];
}

interface LoadedModule {
  id: string;
  slug: string;
  name: unknown;
  order: number;
  unlockRule: unknown;
  levels: LoadedLevel[];
}

interface LoadedWorld {
  id: string;
  slug: string;
  name: unknown;
  tagline: unknown;
  theme: string;
  horizon: boolean;
  modules: LoadedModule[];
}

/**
 * The program's content graph in map order: PUBLISHED worlds only, PUBLISHED
 * levels only (a published level always has a pinned snapshot id). Horizon
 * worlds are roadmap art — their modules/levels are never exposed, whatever
 * the database happens to contain under them.
 */
async function loadProgramContent(programId: string): Promise<LoadedWorld[]> {
  const programWorlds = await db.programWorld.findMany({
    where: { programId, world: { status: "PUBLISHED" } },
    orderBy: { order: "asc" },
    select: {
      world: {
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          theme: true,
          horizon: true,
          modules: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              slug: true,
              name: true,
              order: true,
              unlockRule: true,
              levels: {
                where: { status: "PUBLISHED", publishedVersionId: { not: null } },
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  slug: true,
                  order: true,
                  activityType: true,
                  difficulty: true,
                  estimatedMinutes: true,
                  maxStars: true,
                  publishedVersionId: true,
                  prerequisites: { select: { requiresLevelId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return programWorlds.map(({ world }) => ({
    id: world.id,
    slug: world.slug,
    name: world.name,
    tagline: world.tagline,
    theme: world.theme,
    horizon: world.horizon,
    modules: world.horizon
      ? []
      : world.modules.map((mod) => ({
          id: mod.id,
          slug: mod.slug,
          name: mod.name,
          order: mod.order,
          unlockRule: mod.unlockRule,
          levels: mod.levels.map((level) => ({
            id: level.id,
            slug: level.slug,
            order: level.order,
            activityType: level.activityType,
            difficulty: level.difficulty,
            estimatedMinutes: level.estimatedMinutes,
            maxStars: level.maxStars,
            // Non-null by the where clause above.
            publishedVersionId: level.publishedVersionId as string,
            prereqIds: level.prerequisites.map((p) => p.requiresLevelId),
          })),
        })),
  }));
}

interface ProgressRow {
  levelId: string;
  status: "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";
  stars: number;
}

/** The calling student's own rows ONLY — compound (student + school) filter. */
async function loadProgressRows(
  studentUserId: string,
  schoolId: string,
  levelIds: string[],
): Promise<Map<string, ProgressRow>> {
  if (levelIds.length === 0) return new Map();
  const rows = await db.studentProgress.findMany({
    where: { studentUserId, schoolId, levelId: { in: levelIds } },
    select: { levelId: true, status: true, stars: true },
  });
  return new Map(rows.map((row) => [row.levelId, row]));
}

// ── Queries (registered in ./queries.ts tenantScopedQueries) ─────────────

export async function computeAdventureState(ctx: SessionContext): Promise<AdventureState> {
  const schoolId = requireSchool(ctx);
  const program = await resolveProgramForStudent(ctx.userId, schoolId);
  if (!program) return { program: null, worlds: [], currentLevelId: null };

  // Materialize unlocks before reading them, or a student who has never
  // submitted anything sees every level LOCKED forever: absence of a
  // StudentProgress row means LOCKED, rows were only ever written by
  // recomputeUnlocks, and recomputeUnlocks only ran after a submission or a
  // teacher assignment — which a locked-out student can never trigger.
  //
  // Safe on a read path: it never downgrades or removes an existing row, and
  // once a student's first levels exist it computes to nothing and writes
  // nothing. It is also what makes this self-healing — a student whose school
  // gained (or changed) its curriculum after they were created gets their
  // starting levels on the next page load rather than needing a backfill.
  const worlds = await loadProgramContent(program.id);
  // Reuses the content just loaded rather than resolving and re-loading it:
  // ordering matters, since the progress rows below must see anything this
  // materializes.
  await recomputeUnlocksFor(ctx.userId, schoolId, worlds);

  const allLevels = worlds.flatMap((w) => w.modules.flatMap((m) => m.levels));
  const [progress, versions] = await Promise.all([
    loadProgressRows(ctx.userId, schoolId, allLevels.map((l) => l.id)),
    db.levelVersion.findMany({
      where: { id: { in: allLevels.map((l) => l.publishedVersionId) } },
      select: { id: true, snapshot: true },
    }),
  ]);
  const textByVersionId = new Map<string, SnapshotText>();
  for (const version of versions) {
    const text = parseSnapshotText(version.snapshot);
    if (text) textByVersionId.set(version.id, text);
  }

  const worldNodes: AdventureWorldNode[] = [];
  let isFirstRealWorld = true;
  let previousRealWorldCompleted = false;

  for (const world of worlds) {
    const moduleNodes: AdventureModuleNode[] = world.modules.map((mod) => ({
      id: mod.id,
      slug: mod.slug,
      name: asText(mod.name, mod.slug),
      order: mod.order,
      levels: mod.levels.flatMap((level) => {
        // A published level whose snapshot is missing/malformed is not
        // renderable from published text — treat as invisible rather than
        // fall back to draft fields.
        const text = textByVersionId.get(level.publishedVersionId);
        if (!text) return [];
        const row = progress.get(level.id);
        return [
          {
            id: level.id,
            slug: level.slug,
            title: text.title,
            order: level.order,
            activityType: level.activityType,
            difficulty: level.difficulty,
            estimatedMinutes: level.estimatedMinutes,
            maxStars: level.maxStars,
            state: row?.status ?? "LOCKED",
            stars: row?.stars ?? 0,
            current: false,
          } satisfies AdventureLevelNode,
        ];
      }),
    }));

    const levelNodes = moduleNodes.flatMap((m) => m.levels);
    const totalLevels = levelNodes.length;
    const completedLevels = levelNodes.filter((l) => l.state === "COMPLETED").length;
    const starsEarned = levelNodes.reduce((sum, l) => sum + l.stars, 0);
    const totalStars = levelNodes.reduce((sum, l) => sum + l.maxStars, 0);

    let state: AdventureWorldNode["state"];
    if (world.horizon) {
      state = "HORIZON";
    } else {
      const available = isFirstRealWorld || previousRealWorldCompleted;
      const completed = totalLevels > 0 && completedLevels === totalLevels;
      state = completed ? "COMPLETED" : available ? "AVAILABLE" : "LOCKED";
      isFirstRealWorld = false;
      // Tightened world gate: the NEXT world opens only when this one is
      // fully completed (an empty world never counts as completed).
      previousRealWorldCompleted = completed;
    }

    worldNodes.push({
      id: world.id,
      slug: world.slug,
      name: asText(world.name, world.slug),
      tagline: asTextOrNull(world.tagline),
      theme: world.theme,
      horizon: world.horizon,
      state,
      completedLevels,
      totalLevels,
      starsEarned,
      totalStars,
      modules: moduleNodes,
    });
  }

  // CURRENT world = first available (non-completed) world in program order.
  const currentWorld = worldNodes.find((w) => w.state === "AVAILABLE");
  if (currentWorld) currentWorld.state = "CURRENT";

  // Current level = lowest-order UNLOCKED/IN_PROGRESS level of the current
  // world (modules are already in order, levels in order within them).
  let currentLevelId: string | null = null;
  if (currentWorld) {
    for (const mod of currentWorld.modules) {
      const candidate = mod.levels.find(
        (l) => l.state === "UNLOCKED" || l.state === "IN_PROGRESS",
      );
      if (candidate) {
        candidate.current = true;
        currentLevelId = candidate.id;
        break;
      }
    }
  }

  return { program, worlds: worldNodes, currentLevelId };
}

export async function getLevelIntro(
  ctx: SessionContext,
  levelId: string,
): Promise<LevelIntro | null> {
  const schoolId = requireSchool(ctx);
  const program = await resolveProgramForStudent(ctx.userId, schoolId);
  if (!program) return null;

  const level = await db.level.findFirst({
    where: { id: levelId, status: "PUBLISHED", publishedVersionId: { not: null } },
    select: {
      id: true,
      slug: true,
      activityType: true,
      difficulty: true,
      estimatedMinutes: true,
      maxStars: true,
      publishedVersionId: true,
      module: {
        select: { world: { select: { id: true, status: true, horizon: true } } },
      },
    },
  });
  if (!level) return null;

  // Foreign content: the level's world must be published, non-horizon, and
  // part of THIS student's program.
  const world = level.module.world;
  if (world.status !== "PUBLISHED" || world.horizon) return null;
  const inProgram = await db.programWorld.findFirst({
    where: { programId: program.id, worldId: world.id },
    select: { id: true },
  });
  if (!inProgram) return null;

  // No progress row = LOCKED = no intro. Progress/stars come only from the
  // calling student's own rows (compound student + school filter).
  const row = await db.studentProgress.findFirst({
    where: { studentUserId: ctx.userId, schoolId, levelId: level.id },
    select: { status: true, stars: true },
  });
  if (!row) return null;

  const version = await db.levelVersion.findUnique({
    where: { id: level.publishedVersionId as string },
    select: { snapshot: true },
  });
  const text = version ? parseSnapshotText(version.snapshot) : null;
  if (!text) return null;

  // Built field-by-field — NEVER spread the snapshot: payload/hints (and any
  // other answer-bearing content) must not reach the student surface.
  return {
    id: level.id,
    slug: level.slug,
    title: text.title,
    story: text.story ?? null,
    objective: text.objective ?? null,
    instructions: text.instructions ?? null,
    difficulty: level.difficulty,
    estimatedMinutes: level.estimatedMinutes,
    maxStars: level.maxStars,
    stars: row.stars,
    state: row.status,
    activityType: level.activityType,
  };
}

// ── Unlock recomputation (mutation — called after completions and by seed) ──

export async function recomputeUnlocks(studentUserId: string): Promise<void> {
  const profile = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    select: { schoolId: true, programId: true },
  });
  if (!profile) return;

  const program = await resolveProgramForSchool(profile.schoolId, profile.programId);
  if (!program) return;

  const worlds = await loadProgramContent(program.id);
  await recomputeUnlocksFor(studentUserId, profile.schoolId, worlds);
}

/**
 * The unlock rules themselves, over content the caller has already loaded.
 *
 * Split out so computeAdventureState can reuse the worlds it is about to
 * render. Calling the resolving form there ran the whole pipeline twice on
 * every map view — profile lookup, programme resolution, loadProgramContent
 * and the progress rows — for data the caller already had in hand.
 */
async function recomputeUnlocksFor(
  studentUserId: string,
  schoolId: string,
  worlds: LoadedWorld[],
): Promise<void> {
  const allLevelIds = worlds.flatMap((w) =>
    w.modules.flatMap((m) => m.levels.map((l) => l.id)),
  );
  const progress = await loadProgressRows(studentUserId, schoolId, allLevelIds);
  const isCompleted = (levelId: string): boolean =>
    progress.get(levelId)?.status === "COMPLETED";

  const toCreate: Array<{
    levelId: string;
    unlockSource: "ORDER" | "PREREQUISITE" | "OPEN";
  }> = [];

  let isFirstRealWorld = true;
  let previousRealWorldCompleted = false;

  for (const world of worlds) {
    if (world.horizon) continue; // roadmap art — nothing to unlock, ever

    const worldAvailable = isFirstRealWorld || previousRealWorldCompleted;
    isFirstRealWorld = false;

    let previousModuleAllComplete = false;
    for (const [moduleIndex, mod] of world.modules.entries()) {
      // OPEN modules (phase G graft: AI-concept modules with no coding
      // prerequisite) unlock the instant they're reachable at all — they
      // skip both the previous-world and previous-module gates entirely.
      // Every other module keeps the default previous-module-complete gate.
      const openModule = isOpenUnlockRule(mod.unlockRule);
      const moduleUnlocked =
        openModule || (worldAvailable && (moduleIndex === 0 || previousModuleAllComplete));

      if (moduleUnlocked) {
        for (const [levelIndex, level] of mod.levels.entries()) {
          // Existing rows are never touched — no downgrade, no removal.
          if (progress.has(level.id)) continue;
          if (level.prereqIds.length > 0) {
            // Explicit AND-edges override linear order (and OPEN) for this level.
            if (level.prereqIds.every(isCompleted)) {
              toCreate.push({ levelId: level.id, unlockSource: "PREREQUISITE" });
            }
          } else if (openModule) {
            // Every level in an OPEN module unlocks at once — there is no
            // linear order to respect inside it.
            toCreate.push({ levelId: level.id, unlockSource: "OPEN" });
          } else if (
            levelIndex === 0 ||
            isCompleted(mod.levels[levelIndex - 1]!.id)
          ) {
            // Linear order runs over PUBLISHED levels only — draft/archived
            // levels between two published ones never block the chain.
            toCreate.push({ levelId: level.id, unlockSource: "ORDER" });
          }
        }
      }

      // An empty (zero published levels) module never counts as completed,
      // so it gates the next module until it gains published content.
      previousModuleAllComplete =
        mod.levels.length > 0 && mod.levels.every((l) => isCompleted(l.id));
    }

    previousRealWorldCompleted = worldFullyCompleted(world, isCompleted);
  }

  if (toCreate.length > 0) {
    await db.studentProgress.createMany({
      data: toCreate.map((entry) => ({
        schoolId: schoolId,
        studentUserId,
        levelId: entry.levelId,
        status: "UNLOCKED" as const,
        unlockSource: entry.unlockSource,
      })),
      // Concurrent recomputes must not fail or duplicate on the
      // (studentUserId, levelId) unique constraint.
      skipDuplicates: true,
    });
  }
}

/**
 * Tightened world gate (m3-contracts): a world only counts as cleared when
 * EVERY published level in it is COMPLETED. A world with zero published
 * levels never counts — it gates the next world until it gains content.
 */
function worldFullyCompleted(
  world: LoadedWorld,
  isCompleted: (levelId: string) => boolean,
): boolean {
  const levels = world.modules.flatMap((m) => m.levels);
  return levels.length > 0 && levels.every((l) => isCompleted(l.id));
}
