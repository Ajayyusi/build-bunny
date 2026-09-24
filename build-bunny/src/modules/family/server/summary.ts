import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { localizedText, worldPowerSchema, type LocalizedText } from "@/modules/curriculum/schemas";

import { resolveEntitlement } from "@/modules/schools/server/entitlement";

import { createRateLimiter } from "@/lib/rate-limit";

import { hashFamilyToken } from "./links";

/**
 * The family page is public. A family opens it a few times a week; this
 * stops a script from hammering it (each view reads several tables and
 * records the visit). Over the limit, the page reads "not active".
 */
const viewLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
export function allowFamilyView(clientKey: string): boolean {
  return viewLimiter.allow(clientKey);
}

/**
 * The family view's data (brief §6): a read-only weekly summary for one
 * child, reached by a teacher-shared link — no session at all. It resolves
 * the token's hash to ONE child and reads only that child's rows, and it
 * carries deliberately little: first name as the school shows it, worlds
 * and Powers, what was finished this week, active days, and what they are
 * learning now. Never attempts, hints, flags, workspace content, other
 * children, or anything a teacher wrote about the child.
 *
 * Unknown, revoked and expired tokens are indistinguishable (null), the same
 * rule the public certificate check follows.
 */

export interface FamilyWorld {
  name: LocalizedText;
  completed: number;
  total: number;
  power: { name: LocalizedText; glyph: string } | null;
  powerEarned: boolean;
}

export interface FamilySummary {
  displayName: string;
  schoolName: string;
  weekStart: Date;
  thisWeek: {
    levelsCompleted: number;
    activeDays: number;
    levelTitles: LocalizedText[];
  };
  totals: { levelsCompleted: number; stars: number };
  worlds: FamilyWorld[];
  /** The next level on the trail: what they are learning now. */
  learningNow: { title: LocalizedText; mission: LocalizedText | null } | null;
  expiresAt: Date;
}

const nowSnapshotSchema = z
  .object({ title: localizedText, mission: localizedText.nullish() })
  .passthrough();

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getFamilySummary(token: string, now = new Date()): Promise<FamilySummary | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const link = await db.familyLink.findUnique({
    where: { tokenHash: hashFamilyToken(token) },
    select: {
      id: true,
      schoolId: true,
      studentUserId: true,
      revokedAt: true,
      expiresAt: true,
      school: { select: { name: true, status: true } },
    },
  });
  if (!link || link.revokedAt || link.expiresAt <= now) return null;
  if (link.school.status !== "ACTIVE") return null;
  // A suspended or expired licence closes the family view too.
  if (!(await resolveEntitlement(link.schoolId)).canAccess) return null;

  const { schoolId, studentUserId } = link;
  const weekStart = new Date(now.getTime() - WEEK_MS);

  const [student, progress, activeDays] = await Promise.all([
    db.user.findFirst({
      // A disabled child's progress is no longer shared.
      where: { id: studentUserId, schoolId, role: "STUDENT", banned: { not: true } },
      select: { displayName: true, studentProfile: { select: { programId: true } } },
    }),
    db.studentProgress.findMany({
      where: { schoolId, studentUserId },
      select: {
        levelId: true,
        status: true,
        stars: true,
        firstCompletedAt: true,
      },
    }),
    db.studentDailyActivity.count({
      where: { schoolId, studentUserId, date: { gte: weekStart } },
    }),
  ]);
  if (!student) return null;

  // The child's programme, in map order: the school's single enabled
  // programme unless the child is pinned to another.
  let programId = student.studentProfile?.programId ?? null;
  if (!programId) {
    const enabled = await db.schoolProgram.findMany({ where: { schoolId }, select: { programId: true }, take: 2 });
    programId = enabled.length === 1 ? enabled[0]!.programId : null;
  }
  const programWorlds = programId
    ? await db.programWorld.findMany({
        where: { programId, world: { status: "PUBLISHED", horizon: false } },
        orderBy: { order: "asc" },
        select: {
          world: {
            select: {
              name: true,
              power: true,
              modules: {
                orderBy: { order: "asc" },
                select: {
                  levels: {
                    where: { status: "PUBLISHED", publishedVersionId: { not: null } },
                    orderBy: { order: "asc" },
                    select: { id: true, publishedVersionId: true },
                  },
                },
              },
            },
          },
        },
      })
    : [];

  // Titles come from the PUBLISHED snapshot — what the child actually
  // played — never the draft row, which may be mid-edit.
  const versionIds = programWorlds.flatMap(({ world }) =>
    world.modules.flatMap((m) => m.levels.map((l) => l.publishedVersionId as string)),
  );
  const versions = versionIds.length
    ? await db.levelVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, snapshot: true } })
    : [];
  const snapshotById = new Map(versions.map((v) => [v.id, v.snapshot]));
  const byLevel = new Map(progress.map((row) => [row.levelId, row]));
  const worlds: FamilyWorld[] = [];
  const titleById = new Map<string, LocalizedText>();
  let nextLevel: { id: string; versionId: string } | null = null;
  for (const { world } of programWorlds) {
    const levels = world.modules.flatMap((m) => m.levels);
    let completed = 0;
    for (const level of levels) {
      const snap = nowSnapshotSchema.safeParse(snapshotById.get(level.publishedVersionId as string));
      if (snap.success) titleById.set(level.id, snap.data.title);
      const row = byLevel.get(level.id);
      if (row?.status === "COMPLETED") completed += 1;
      else if (!nextLevel && row && (row.status === "UNLOCKED" || row.status === "IN_PROGRESS")) {
        nextLevel = { id: level.id, versionId: level.publishedVersionId as string };
      }
    }
    const name = localizedText.safeParse(world.name);
    const power = worldPowerSchema.safeParse(world.power);
    worlds.push({
      name: name.success ? name.data : { en: "" },
      completed,
      total: levels.length,
      power: power.success ? { name: power.data.name, glyph: power.data.glyph } : null,
      powerEarned: levels.length > 0 && completed === levels.length,
    });
  }

  let learningNow: FamilySummary["learningNow"] = null;
  if (nextLevel) {
    const parsed = nowSnapshotSchema.safeParse(snapshotById.get(nextLevel.versionId));
    if (parsed.success) learningNow = { title: parsed.data.title, mission: parsed.data.mission ?? null };
  }

  const completedRows = progress.filter((row) => row.status === "COMPLETED");
  const thisWeekRows = completedRows
    .filter((row) => row.firstCompletedAt && row.firstCompletedAt >= weekStart)
    .sort((a, b) => (b.firstCompletedAt!.getTime() - a.firstCompletedAt!.getTime()));

  // Best-effort "seen" stamp so a teacher knows the link was opened.
  await db.familyLink
    .update({ where: { id: link.id }, data: { lastViewedAt: now } })
    .catch(() => {});

  return {
    displayName: student.displayName,
    schoolName: link.school.name,
    weekStart,
    thisWeek: {
      levelsCompleted: thisWeekRows.length,
      activeDays,
      levelTitles: thisWeekRows
        .slice(0, 6)
        .flatMap((row) => {
          const title = titleById.get(row.levelId);
          return title ? [title] : [];
        }),
    },
    totals: {
      levelsCompleted: completedRows.length,
      stars: completedRows.reduce((sum, row) => sum + row.stars, 0),
    },
    worlds,
    learningNow,
    expiresAt: link.expiresAt,
  };
}
