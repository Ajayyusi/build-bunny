import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { Role } from "@/modules/auth/roles";
import {
  levelFixtureSchema,
  programFixtureSchema,
  validatePayload,
  worldFixtureSchema,
  type LocalizedText,
  type ProgramFixture,
  type WorldFixture,
} from "@/modules/curriculum/schemas";

/**
 * JSON bundle import service (plan §0.1-2): fixtures are an IMPORT FORMAT,
 * the database is the source of truth. Upserts key on slug paths, never
 * delete, and re-importing identical content is a no-op — so the bundled
 * content, the seed, and the platform import wizard can all run the same
 * bundle any number of times.
 *
 * Status is never touched by import: new entities start DRAFT, and a
 * PUBLISHED entity keeps its published snapshot (LevelVersion) untouched —
 * only its draft row fields are updated (reported as an update).
 */

export interface ImportBundle {
  programs: ProgramFixture[];
  worlds: WorldFixture[];
}

export interface ImportDiff {
  creates: string[];
  updates: string[];
  unchanged: string[];
  issues: string[];
}

export const CURRICULUM_IMPORTED_ACTION = "curriculum.imported";

const bundleSchema = z.object({
  programs: z.array(programFixtureSchema),
  worlds: z.array(worldFixtureSchema),
});

type ParsedBundle = z.infer<typeof bundleSchema>;
type ParsedLevel = z.infer<typeof levelFixtureSchema>;
type DbClient = Prisma.TransactionClient | typeof db;

// ── Comparison helpers ────────────────────────────────────────────────────

/**
 * Key-order-insensitive serialization: Postgres jsonb does not preserve key
 * order, so structural equality is the only honest "unchanged" test.
 * Undefined-valued keys are skipped (JSON semantics).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`)
    .join(",")}}`;
}

function sameContent(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/** Prisma Json? columns take DbNull, not null, for "no value". */
function toJson(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
  return value === undefined || value === null
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);
}

function hasArabic(value: LocalizedText | undefined): boolean {
  return value === undefined || (value.ar ?? "").trim().length > 0;
}

/**
 * A level is AR-complete when every STUDENT-FACING localized field has
 * Arabic. `teacherNotes` is deliberately excluded (m5-contracts §1):
 * it's a staff-only field, never shown to students, never localized in
 * the player UI, and is intentionally shipped English-only — requiring
 * Arabic there would make `arComplete: true` impossible for content whose
 * teaching copy is fully translated, which defeats the flag's purpose.
 */
function computeArComplete(level: ParsedLevel): boolean {
  const hintsArabic = level.hints.every((h) => hasArabic(h.text));
  return (
    hasArabic(level.title) &&
    hasArabic(level.story) &&
    hasArabic(level.objective) &&
    hasArabic(level.instructions) &&
    hasArabic(level.explanation) &&
    hintsArabic
  );
}

// ── Core upsert walk ──────────────────────────────────────────────────────

interface LevelPlanEntry {
  label: string;
  moduleSlug: string;
  fixture: ParsedLevel;
  /** Known id when the level already exists (or was just created in apply). */
  levelId: string | null;
  outcome: "create" | "update" | "unchanged" | "skipped";
}

/**
 * Orders are unique per parent (@@unique compounds), so reorders are applied
 * in two phases: entities whose order changes are first parked at negative
 * temp orders (real orders are ≥ 1), then everything is written at its final
 * order — a swap can never trip the unique constraint mid-flight.
 */
async function runImport(
  client: DbClient,
  bundle: ParsedBundle,
  apply: boolean,
): Promise<ImportDiff> {
  const diff: ImportDiff = { creates: [], updates: [], unchanged: [], issues: [] };
  const worldIdBySlug = new Map<string, string>();

  for (const worldFx of bundle.worlds) {
    const worldLabel = `world:${worldFx.slug}`;
    const existingWorld = await client.world.findUnique({
      where: { slug: worldFx.slug },
    });
    let worldId = existingWorld?.id ?? null;

    if (!existingWorld) {
      diff.creates.push(worldLabel);
      if (apply) {
        const created = await client.world.create({
          data: {
            slug: worldFx.slug,
            name: worldFx.name as Prisma.InputJsonValue,
            tagline: toJson(worldFx.tagline),
            theme: worldFx.theme,
            horizon: worldFx.horizon,
          },
        });
        worldId = created.id;
      }
    } else {
      const current = {
        name: existingWorld.name,
        tagline: existingWorld.tagline,
        theme: existingWorld.theme,
        horizon: existingWorld.horizon,
      };
      const target = {
        name: worldFx.name,
        tagline: worldFx.tagline ?? null,
        theme: worldFx.theme,
        horizon: worldFx.horizon,
      };
      if (sameContent(current, target)) {
        diff.unchanged.push(worldLabel);
      } else {
        diff.updates.push(worldLabel);
        if (apply) {
          await client.world.update({
            where: { id: existingWorld.id },
            data: {
              name: worldFx.name as Prisma.InputJsonValue,
              tagline: toJson(worldFx.tagline),
              theme: worldFx.theme,
              horizon: worldFx.horizon,
            },
          });
        }
      }
    }
    if (worldId) worldIdBySlug.set(worldFx.slug, worldId);

    const levelPlans: LevelPlanEntry[] = [];
    const levelIdBySlug = new Map<string, string>();

    // ── Modules of this world ──
    interface ModulePlan {
      fixture: (typeof worldFx.modules)[number];
      existing: { id: string; order: number } | null;
      outcome: "create" | "update" | "unchanged";
    }
    const modulePlans: ModulePlan[] = [];
    for (const moduleFx of worldFx.modules) {
      const moduleLabel = `${worldLabel}/module:${moduleFx.slug}`;
      const existingModule = worldId
        ? await client.module.findUnique({
            where: { worldId_slug: { worldId, slug: moduleFx.slug } },
          })
        : null;
      if (!existingModule) {
        diff.creates.push(moduleLabel);
        modulePlans.push({ fixture: moduleFx, existing: null, outcome: "create" });
      } else {
        // unlockRule is not part of the fixture format — import neither
        // writes nor compares it, so a rule authored later survives imports.
        const current = {
          name: existingModule.name,
          description: existingModule.description,
          order: existingModule.order,
        };
        const target = {
          name: moduleFx.name,
          description: moduleFx.description ?? null,
          order: moduleFx.order,
        };
        const outcome = sameContent(current, target) ? "unchanged" : "update";
        diff[outcome === "unchanged" ? "unchanged" : "updates"].push(moduleLabel);
        modulePlans.push({
          fixture: moduleFx,
          existing: { id: existingModule.id, order: existingModule.order },
          outcome,
        });
      }
    }

    const moduleIdBySlug = new Map<string, string>();
    if (apply && worldId) {
      // Phase 1: park reordered modules at temp negative orders.
      let temp = -1;
      for (const plan of modulePlans) {
        if (
          plan.outcome === "update" &&
          plan.existing &&
          plan.existing.order !== plan.fixture.order
        ) {
          await client.module.update({
            where: { id: plan.existing.id },
            data: { order: temp-- },
          });
        }
      }
      // Phase 2: creates + final field writes.
      for (const plan of modulePlans) {
        if (plan.outcome === "create") {
          const created = await client.module.create({
            data: {
              worldId,
              slug: plan.fixture.slug,
              name: plan.fixture.name as Prisma.InputJsonValue,
              description: toJson(plan.fixture.description),
              order: plan.fixture.order,
            },
          });
          moduleIdBySlug.set(plan.fixture.slug, created.id);
        } else if (plan.existing) {
          if (plan.outcome === "update") {
            await client.module.update({
              where: { id: plan.existing.id },
              data: {
                name: plan.fixture.name as Prisma.InputJsonValue,
                description: toJson(plan.fixture.description),
                order: plan.fixture.order,
              },
            });
          }
          moduleIdBySlug.set(plan.fixture.slug, plan.existing.id);
        }
      }
    } else {
      for (const plan of modulePlans) {
        if (plan.existing) moduleIdBySlug.set(plan.fixture.slug, plan.existing.id);
      }
    }

    // ── Levels of each module ──
    for (const moduleFx of worldFx.modules) {
      const moduleId = moduleIdBySlug.get(moduleFx.slug) ?? null;

      interface LevelWritePlan {
        entry: LevelPlanEntry;
        existing: { id: string; order: number } | null;
        payload: unknown;
        arComplete: boolean;
      }
      const writePlans: LevelWritePlan[] = [];

      for (const levelFx of moduleFx.levels) {
        const levelLabel = `${worldLabel}/module:${moduleFx.slug}/level:${levelFx.slug}`;
        const payloadResult = validatePayload(levelFx.activityType, levelFx.payload);
        if (!payloadResult.ok) {
          diff.issues.push(
            `${levelLabel}: invalid payload — ${payloadResult.issues.join("; ")}`,
          );
          levelPlans.push({
            label: levelLabel,
            moduleSlug: moduleFx.slug,
            fixture: levelFx,
            levelId: null,
            outcome: "skipped",
          });
          continue;
        }
        const normalizedPayload = payloadResult.data;
        const arComplete = computeArComplete(levelFx);

        const existingLevel = moduleId
          ? await client.level.findUnique({
              where: { moduleId_slug: { moduleId, slug: levelFx.slug } },
            })
          : null;

        let outcome: LevelPlanEntry["outcome"];
        if (!existingLevel) {
          outcome = "create";
          diff.creates.push(levelLabel);
        } else {
          const current = {
            order: existingLevel.order,
            activityType: existingLevel.activityType,
            track: existingLevel.track,
            title: existingLevel.title,
            story: existingLevel.story,
            objective: existingLevel.objective,
            instructions: existingLevel.instructions,
            explanation: existingLevel.explanation,
            teacherNotes: existingLevel.teacherNotes,
            difficulty: existingLevel.difficulty,
            recommendedGradeMin: existingLevel.recommendedGradeMin,
            recommendedGradeMax: existingLevel.recommendedGradeMax,
            estimatedMinutes: existingLevel.estimatedMinutes,
            xpReward: existingLevel.xpReward,
            tags: existingLevel.tags,
            payload: existingLevel.payload,
            hints: existingLevel.hints,
            arComplete: existingLevel.arComplete,
          };
          const target = {
            order: levelFx.order,
            activityType: levelFx.activityType,
            track: levelFx.track,
            title: levelFx.title,
            story: levelFx.story ?? null,
            objective: levelFx.objective,
            instructions: levelFx.instructions,
            explanation: levelFx.explanation,
            teacherNotes: levelFx.teacherNotes ?? null,
            difficulty: levelFx.difficulty,
            recommendedGradeMin: levelFx.recommendedGradeMin ?? null,
            recommendedGradeMax: levelFx.recommendedGradeMax ?? null,
            estimatedMinutes: levelFx.estimatedMinutes,
            xpReward: levelFx.xpReward ?? null,
            tags: levelFx.tags,
            payload: normalizedPayload,
            hints: levelFx.hints,
            arComplete,
          };
          outcome = sameContent(current, target) ? "unchanged" : "update";
          diff[outcome === "unchanged" ? "unchanged" : "updates"].push(levelLabel);
          levelIdBySlug.set(levelFx.slug, existingLevel.id);
        }

        const entry: LevelPlanEntry = {
          label: levelLabel,
          moduleSlug: moduleFx.slug,
          fixture: levelFx,
          levelId: existingLevel?.id ?? null,
          outcome,
        };
        levelPlans.push(entry);
        writePlans.push({
          entry,
          existing: existingLevel
            ? { id: existingLevel.id, order: existingLevel.order }
            : null,
          payload: normalizedPayload,
          arComplete,
        });
      }

      if (apply && moduleId) {
        let temp = -1;
        for (const plan of writePlans) {
          if (
            plan.entry.outcome === "update" &&
            plan.existing &&
            plan.existing.order !== plan.entry.fixture.order
          ) {
            await client.level.update({
              where: { id: plan.existing.id },
              data: { order: temp-- },
            });
          }
        }
        for (const plan of writePlans) {
          const fx = plan.entry.fixture;
          const data = {
            order: fx.order,
            activityType: fx.activityType,
            track: fx.track,
            title: fx.title as Prisma.InputJsonValue,
            story: toJson(fx.story),
            objective: fx.objective as Prisma.InputJsonValue,
            instructions: fx.instructions as Prisma.InputJsonValue,
            explanation: fx.explanation as Prisma.InputJsonValue,
            teacherNotes: toJson(fx.teacherNotes),
            difficulty: fx.difficulty,
            recommendedGradeMin: fx.recommendedGradeMin ?? null,
            recommendedGradeMax: fx.recommendedGradeMax ?? null,
            estimatedMinutes: fx.estimatedMinutes,
            xpReward: fx.xpReward ?? null,
            tags: fx.tags,
            payload: plan.payload as Prisma.InputJsonValue,
            hints: fx.hints as unknown as Prisma.InputJsonValue,
            arComplete: plan.arComplete,
          };
          if (plan.entry.outcome === "create") {
            const created = await client.level.create({
              data: { moduleId, slug: fx.slug, ...data },
            });
            plan.entry.levelId = created.id;
            levelIdBySlug.set(fx.slug, created.id);
          } else if (plan.entry.outcome === "update" && plan.existing) {
            await client.level.update({ where: { id: plan.existing.id }, data });
          }
        }
      }
    }

    // ── Prerequisite edges (level slugs resolve within the world) ──
    const fixtureSlugs = new Set(
      worldFx.modules.flatMap((m) => m.levels.map((l) => l.slug)),
    );
    for (const plan of levelPlans) {
      if (plan.outcome === "skipped") continue;
      for (const requiredSlug of plan.fixture.requires) {
        if (!fixtureSlugs.has(requiredSlug) && !levelIdBySlug.has(requiredSlug)) {
          diff.issues.push(
            `${plan.label}: unknown prerequisite level slug "${requiredSlug}"`,
          );
          continue;
        }
        const levelId = plan.levelId;
        const requiresLevelId = levelIdBySlug.get(requiredSlug) ?? null;
        if (!levelId || !requiresLevelId) continue; // dry-run on new levels
        const existingEdge = await client.levelPrerequisite.findUnique({
          where: { levelId_requiresLevelId: { levelId, requiresLevelId } },
        });
        if (existingEdge) continue;
        // A new edge on an otherwise-unchanged level is still an update.
        if (plan.outcome === "unchanged") {
          const idx = diff.unchanged.indexOf(plan.label);
          if (idx >= 0) {
            diff.unchanged.splice(idx, 1);
            diff.updates.push(plan.label);
          }
          plan.outcome = "update";
        }
        if (apply) {
          await client.levelPrerequisite.create({
            data: { levelId, requiresLevelId },
          });
        }
      }
    }
  }

  // ── Programs + world links ──
  for (const programFx of bundle.programs) {
    const programLabel = `program:${programFx.slug}`;
    const existingProgram = await client.program.findUnique({
      where: { slug: programFx.slug },
      include: { worlds: { select: { id: true, worldId: true, order: true } } },
    });

    // Resolve the ordered world slugs to ids (bundle first, then DB).
    const desiredLinks: { worldId: string; order: number }[] = [];
    let unresolvable = false;
    for (const [index, worldSlug] of programFx.worlds.entries()) {
      let worldId = worldIdBySlug.get(worldSlug) ?? null;
      if (!worldId) {
        const dbWorld = await client.world.findUnique({
          where: { slug: worldSlug },
          select: { id: true },
        });
        worldId = dbWorld?.id ?? null;
      }
      if (!worldId) {
        const inBundle = bundle.worlds.some((w) => w.slug === worldSlug);
        if (!inBundle) {
          diff.issues.push(`${programLabel}: unknown world slug "${worldSlug}"`);
        } else {
          // Dry-run: the world would be created by commit, so the link would too.
          unresolvable = true;
        }
        continue;
      }
      desiredLinks.push({ worldId, order: index + 1 });
    }

    if (!existingProgram) {
      diff.creates.push(programLabel);
      if (apply) {
        const created = await client.program.create({
          data: {
            slug: programFx.slug,
            name: programFx.name as Prisma.InputJsonValue,
            description: toJson(programFx.description),
            gradeMin: programFx.gradeMin,
            gradeMax: programFx.gradeMax,
          },
        });
        for (const link of desiredLinks) {
          await client.programWorld.create({
            data: { programId: created.id, ...link },
          });
        }
      }
      continue;
    }

    const currentFields = {
      name: existingProgram.name,
      description: existingProgram.description,
      gradeMin: existingProgram.gradeMin,
      gradeMax: existingProgram.gradeMax,
    };
    const targetFields = {
      name: programFx.name,
      description: programFx.description ?? null,
      gradeMin: programFx.gradeMin,
      gradeMax: programFx.gradeMax,
    };
    const linkByWorldId = new Map(
      existingProgram.worlds.map((w) => [w.worldId, w] as const),
    );
    const linkAdditions = desiredLinks.filter((l) => !linkByWorldId.has(l.worldId));
    const linkReorders = desiredLinks.filter((l) => {
      const existing = linkByWorldId.get(l.worldId);
      return existing !== undefined && existing.order !== l.order;
    });
    const changed =
      !sameContent(currentFields, targetFields) ||
      linkAdditions.length > 0 ||
      linkReorders.length > 0 ||
      unresolvable;

    if (!changed) {
      diff.unchanged.push(programLabel);
      continue;
    }
    diff.updates.push(programLabel);
    if (apply) {
      await client.program.update({
        where: { id: existingProgram.id },
        data: {
          name: programFx.name as Prisma.InputJsonValue,
          description: toJson(programFx.description),
          gradeMin: programFx.gradeMin,
          gradeMax: programFx.gradeMax,
        },
      });
      let temp = -1;
      for (const link of linkReorders) {
        const existing = linkByWorldId.get(link.worldId);
        if (existing) {
          await client.programWorld.update({
            where: { id: existing.id },
            data: { order: temp-- },
          });
        }
      }
      for (const link of linkAdditions) {
        await client.programWorld.create({
          data: { programId: existingProgram.id, ...link },
        });
      }
      for (const link of linkReorders) {
        const existing = linkByWorldId.get(link.worldId);
        if (existing) {
          await client.programWorld.update({
            where: { id: existing.id },
            data: { order: link.order },
          });
        }
      }
    }
  }

  return diff;
}

function parseFailureDiff(error: z.ZodError): ImportDiff {
  return {
    creates: [],
    updates: [],
    unchanged: [],
    issues: error.issues.map((i) => `bundle.${i.path.join(".")}: ${i.message}`),
  };
}

// ── Public API (pinned cross-agent interface) ─────────────────────────────

export async function dryRunImport(bundle: unknown): Promise<ImportDiff> {
  const parsed = bundleSchema.safeParse(bundle);
  if (!parsed.success) return parseFailureDiff(parsed.error);
  return runImport(db, parsed.data, false);
}

export async function commitImport(
  actor: { userId: string; role: Role | "SYSTEM" },
  bundle: unknown,
): Promise<ImportDiff> {
  const parsed = bundleSchema.safeParse(bundle);
  if (!parsed.success) return parseFailureDiff(parsed.error);

  const diff = await db.$transaction(
    async (tx) => runImport(tx, parsed.data, true),
    { timeout: 60_000 },
  );

  await audit({
    action: CURRICULUM_IMPORTED_ACTION,
    actorUserId: actor.userId,
    actorRole: actor.role,
    targetType: "contentBundle",
    meta: {
      creates: diff.creates.length,
      updates: diff.updates.length,
      unchanged: diff.unchanged.length,
      issues: diff.issues,
    },
  });
  return diff;
}
