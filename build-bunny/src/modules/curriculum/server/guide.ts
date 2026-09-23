import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "../schemas";

/**
 * The teacher's curriculum guide (brief §6): every published level of the
 * school's programme in map order, with what a teacher needs to plan a
 * lesson — the learning objective, the child-facing mission, the concepts
 * it practises, who it is written for, how long it takes, and the authored
 * teacher notes. Read from the PUBLISHED snapshot, never the draft row, so
 * the guide describes exactly what children play. Answer keys and hints are
 * never selected.
 */

export interface GuideLevel {
  id: string;
  slug: string;
  order: number;
  activityType: string;
  title: LocalizedText;
  objective: LocalizedText | null;
  mission: LocalizedText | null;
  teacherNotes: LocalizedText | null;
  tags: string[];
  difficulty: string;
  estimatedMinutes: number;
  recommendedGradeMin: number | null;
  recommendedGradeMax: number | null;
}

export interface GuideModule {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText | null;
  levels: GuideLevel[];
  /** Sum of the levels' estimated minutes — the pacing input. */
  totalMinutes: number;
}

export interface GuideWorld {
  id: string;
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText | null;
  power: { name: LocalizedText; idea: LocalizedText; glyph: string } | null;
  modules: GuideModule[];
  totalMinutes: number;
  levelCount: number;
}

const guideSnapshotSchema = z
  .object({
    title: localizedText,
    objective: localizedText.nullish(),
    mission: localizedText.nullish(),
    teacherNotes: localizedText.nullish(),
    tags: z.array(z.string()).default([]),
    difficulty: z.string().default("EASY"),
    estimatedMinutes: z.number().int().default(5),
    recommendedGradeMin: z.number().int().nullish(),
    recommendedGradeMax: z.number().int().nullish(),
  })
  .passthrough();

const powerSchema = z
  .object({ name: localizedText, idea: localizedText, glyph: z.string() })
  .strict();

const textSchema = localizedText.nullish();

export async function getTeacherCurriculumGuide(ctx: SessionContext): Promise<GuideWorld[]> {
  const schoolId = ctx.schoolId;
  if (!schoolId) return [];
  if (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN") return [];

  const enabled = await db.schoolProgram.findMany({
    where: { schoolId },
    select: { programId: true },
  });
  if (enabled.length === 0) return [];

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
          tagline: true,
          power: true,
          modules: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              levels: {
                where: { status: "PUBLISHED", publishedVersionId: { not: null } },
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  slug: true,
                  order: true,
                  activityType: true,
                  publishedVersionId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const versionIds = programWorlds.flatMap(({ world }) =>
    world.modules.flatMap((m) => m.levels.map((l) => l.publishedVersionId as string)),
  );
  const versions = await db.levelVersion.findMany({
    where: { id: { in: versionIds } },
    select: { id: true, snapshot: true },
  });
  const snapshotById = new Map(versions.map((v) => [v.id, v.snapshot]));

  const seenWorlds = new Set<string>();
  const worlds: GuideWorld[] = [];
  for (const { world } of programWorlds) {
    if (seenWorlds.has(world.id)) continue;
    seenWorlds.add(world.id);
    const modules: GuideModule[] = world.modules.map((mod) => {
      const levels: GuideLevel[] = mod.levels.flatMap((level) => {
        const parsed = guideSnapshotSchema.safeParse(
          snapshotById.get(level.publishedVersionId as string),
        );
        if (!parsed.success) return [];
        const s = parsed.data;
        return [
          {
            id: level.id,
            slug: level.slug,
            order: level.order,
            activityType: level.activityType,
            title: s.title,
            objective: s.objective ?? null,
            mission: s.mission ?? null,
            teacherNotes: s.teacherNotes ?? null,
            tags: s.tags,
            difficulty: s.difficulty,
            estimatedMinutes: s.estimatedMinutes,
            recommendedGradeMin: s.recommendedGradeMin ?? null,
            recommendedGradeMax: s.recommendedGradeMax ?? null,
          },
        ];
      });
      return {
        id: mod.id,
        slug: mod.slug,
        name: localizedText.safeParse(mod.name).success
          ? (mod.name as LocalizedText)
          : { en: mod.slug },
        description: textSchema.safeParse(mod.description).success
          ? ((mod.description as LocalizedText | null) ?? null)
          : null,
        levels,
        totalMinutes: levels.reduce((sum, l) => sum + l.estimatedMinutes, 0),
      };
    });
    const power = powerSchema.safeParse(world.power);
    worlds.push({
      id: world.id,
      slug: world.slug,
      name: localizedText.safeParse(world.name).success ? (world.name as LocalizedText) : { en: world.slug },
      tagline: textSchema.safeParse(world.tagline).success
        ? ((world.tagline as LocalizedText | null) ?? null)
        : null,
      power: power.success ? power.data : null,
      modules,
      totalMinutes: modules.reduce((sum, m) => sum + m.totalMinutes, 0),
      levelCount: modules.reduce((sum, m) => sum + m.levels.length, 0),
    });
  }
  return worlds;
}

/** A 40-minute lesson is the planning unit schools asked for. */
export const LESSON_MINUTES = 40;

export function lessonsFor(totalMinutes: number): number {
  return Math.max(1, Math.ceil(totalMinutes / LESSON_MINUTES));
}
