import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";

import { EXPLORE_CARDS } from "../catalog";

/**
 * Activity launch control, the writes. Only a teacher OF the class changes
 * its settings (a school admin can see them on the class page, like the
 * rest of the class report, but doesn't run the class). Every change is
 * audited.
 */

const CARD_SLUGS: ReadonlySet<string> = new Set(EXPLORE_CARDS.map((card) => card.slug));

async function requireClassTeacher(ctx: SessionContext, classId: string): Promise<string> {
  const schoolId = ctx.schoolId;
  if (!schoolId || ctx.role !== "TEACHER") throw new NotFoundError("Only the class's teacher can change this");
  const membership = await db.classMembership.findFirst({
    where: { classId, schoolId, userId: ctx.userId, role: "TEACHER" },
    select: { id: true },
  });
  if (!membership) throw new NotFoundError("Class is not in scope for this account");
  return schoolId;
}

function requireCard(slug: string) {
  if (!CARD_SLUGS.has(slug)) throw new NotFoundError("Not an Explore AI activity");
}

/** Switch one activity on or off for the class. Switching off also stops its launch. */
export async function setExploreActivityOpenCore(
  ctx: SessionContext,
  input: { classId: string; slug: string; open: boolean },
): Promise<{ open: boolean }> {
  requireCard(input.slug);
  const schoolId = await requireClassTeacher(ctx, input.classId);
  await db.classExploreActivity.upsert({
    where: { classId_slug: { classId: input.classId, slug: input.slug } },
    create: { schoolId, classId: input.classId, slug: input.slug, hidden: !input.open, updatedByUserId: ctx.userId },
    update: { hidden: !input.open, ...(input.open ? {} : { launchedAt: null }), updatedByUserId: ctx.userId },
  });
  await audit({
    action: input.open ? "class.explore_activity_opened" : "class.explore_activity_hidden",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "class",
    targetId: input.classId,
    meta: { slug: input.slug },
  });
  return { open: input.open };
}

/** Launch one activity for the class (it opens too); any earlier launch stops. */
export async function launchExploreActivityCore(
  ctx: SessionContext,
  input: { classId: string; slug: string },
): Promise<{ launched: string }> {
  requireCard(input.slug);
  const schoolId = await requireClassTeacher(ctx, input.classId);
  const now = new Date();
  await db.$transaction([
    db.classExploreActivity.updateMany({
      where: { schoolId, classId: input.classId, launchedAt: { not: null } },
      data: { launchedAt: null },
    }),
    db.classExploreActivity.upsert({
      where: { classId_slug: { classId: input.classId, slug: input.slug } },
      create: { schoolId, classId: input.classId, slug: input.slug, hidden: false, launchedAt: now, updatedByUserId: ctx.userId },
      update: { hidden: false, launchedAt: now, updatedByUserId: ctx.userId },
    }),
  ]);
  await audit({
    action: "class.explore_activity_launched",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "class",
    targetId: input.classId,
    meta: { slug: input.slug },
  });
  return { launched: input.slug };
}

/** Stop the class's launch: nothing is pinned any more. */
export async function stopExploreLaunchCore(ctx: SessionContext, input: { classId: string }): Promise<{ launched: null }> {
  const schoolId = await requireClassTeacher(ctx, input.classId);
  await db.classExploreActivity.updateMany({
    where: { schoolId, classId: input.classId, launchedAt: { not: null } },
    data: { launchedAt: null, updatedByUserId: ctx.userId },
  });
  await audit({
    action: "class.explore_launch_stopped",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "class",
    targetId: input.classId,
  });
  return { launched: null };
}
