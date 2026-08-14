import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/modules/auth/server/guard";
import { createStaff, type CreatedCredentials } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  applyFeatureFlag,
  isFeatureEnabled,
  isKnownFeatureFlag,
} from "@/modules/shared/features";

/** Platform-only school lifecycle mutations — SUPER_ADMIN/NITAQ_ADMIN only. */
function requirePlatform(ctx: SessionContext): void {
  if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "NITAQ_ADMIN") {
    throw new Error("Platform-only mutation invoked with a non-platform session");
  }
}

export interface CreateSchoolInput {
  name: string;
  slug: string;
  code: string;
  timezone: string;
  licenceSeats: number;
  licenceStartsAt: Date;
  licenceExpiresAt: Date;
  adminEmail: string;
  adminDisplayName: string;
}

export interface CreateSchoolResult {
  schoolId: string;
  admin: CreatedCredentials;
}

/**
 * One-flow school onboarding (plan §1.2): school → licence → first
 * SCHOOL_ADMIN. Uniqueness is pre-checked so a failed admin email doesn't
 * leave an orphaned school row behind.
 */
export async function createSchoolWithAdmin(
  ctx: SessionContext,
  input: CreateSchoolInput,
): Promise<CreateSchoolResult> {
  requirePlatform(ctx);

  const [slugClash, codeClash] = await Promise.all([
    db.school.findUnique({ where: { slug: input.slug } }),
    db.school.findUnique({ where: { code: input.code } }),
  ]);
  if (slugClash) throw new ConflictError(`School slug "${input.slug}" is already in use`);
  if (codeClash) throw new ConflictError(`School code "${input.code}" is already in use`);

  const school = await db.school.create({
    data: {
      name: input.name,
      slug: input.slug,
      code: input.code.toUpperCase(),
      timezone: input.timezone,
      status: "ACTIVE",
    },
  });
  await db.licence.create({
    data: {
      schoolId: school.id,
      seats: input.licenceSeats,
      startsAt: input.licenceStartsAt,
      expiresAt: input.licenceExpiresAt,
      status: "ACTIVE",
    },
  });
  // Attach the curriculum so the school is usable the moment it exists.
  // Before this, every school created through the console had no programme
  // and no screen that could give it one, so its students sat on the empty
  // adventure map permanently.
  //
  // Only when exactly one programme is published: with several there is no
  // right default to guess, and the programme card on the school page is
  // where that choice belongs. take: 2 is enough to tell one from many.
  const published = await db.program.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true },
    take: 2,
  });
  const defaultProgramId = published.length === 1 ? published[0]!.id : null;
  if (defaultProgramId) {
    await db.schoolProgram.create({ data: { schoolId: school.id, programId: defaultProgramId } });
  }

  await audit({
    action: AUDIT.schools.created,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId: school.id,
    targetType: "school",
    targetId: school.id,
    meta: { code: school.code, seats: input.licenceSeats, programId: defaultProgramId },
  });

  // Not wrapped in the same transaction as the school/licence create:
  // createStaff owns its own writes (password hashing + audit), and rolling
  // back a persisted school row on a duplicate-email failure is an
  // acceptable trade for reusing the single provisioning code path.
  const admin = await createStaff(
    { userId: ctx.userId, role: ctx.role },
    {
      schoolId: school.id,
      email: input.adminEmail,
      displayName: input.adminDisplayName,
      role: "SCHOOL_ADMIN",
    },
  );

  return { schoolId: school.id, admin };
}

/**
 * Turn one feature flag on or off for one school.
 *
 * Read-modify-write through applyFeatureFlag so a toggle cannot clobber the
 * school's other flags, and the key is checked against the registry first:
 * a flag that gates nothing would be a switch an operator can flip with no
 * effect, which is worse than no switch at all. Audited with before/after so
 * "who turned the AI lab on for this school" is answerable.
 */
export async function setSchoolFeatureFlag(
  ctx: SessionContext,
  schoolId: string,
  key: string,
  enabled: boolean,
): Promise<void> {
  requirePlatform(ctx);
  if (!isKnownFeatureFlag(key)) {
    throw new NotFoundError("Unknown feature flag");
  }
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { id: true, features: true },
  });
  if (!school) throw new NotFoundError("School not found");

  const before = isFeatureEnabled(school.features, key);
  await db.school.update({
    where: { id: schoolId },
    // applyFeatureFlag lives in a module shared with client code, so it
    // cannot name Prisma's JSON input types; the shape it returns is a plain
    // JSON object by construction.
    data: { features: applyFeatureFlag(school.features, key, enabled) as Prisma.InputJsonObject },
  });
  await audit({
    action: AUDIT.schools.updated,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "school",
    targetId: schoolId,
    meta: { feature: key, from: before, to: enabled },
  });
}

/**
 * Point a school at one curriculum programme — or at none.
 *
 * REPLACES rather than adds, and that is the whole point. The adventure map
 * resolves a school's programme with `if (enabled.length !== 1) return null`,
 * so a school with TWO enabled programmes shows students the same empty
 * "your adventure is being prepared" screen as a school with none. An
 * operator adding a second programme would silently take the map away from
 * every child in the school, with nothing on this screen to explain it.
 * Deleting first makes that state unreachable.
 *
 * Draft programmes are refused rather than stored: the map only ever renders
 * PUBLISHED content, so accepting one would leave the console claiming a
 * programme is set while students still see nothing.
 */
export async function setSchoolProgram(
  ctx: SessionContext,
  schoolId: string,
  programId: string | null,
): Promise<void> {
  requirePlatform(ctx);
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) throw new NotFoundError("School not found");

  if (programId) {
    const program = await db.program.findFirst({
      where: { id: programId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!program) throw new NotFoundError("Published programme not found");
  }

  const before = await db.schoolProgram.findMany({
    where: { schoolId },
    select: { programId: true },
  });

  await db.$transaction(async (tx) => {
    await tx.schoolProgram.deleteMany({ where: { schoolId } });
    if (programId) {
      await tx.schoolProgram.create({ data: { schoolId, programId } });
    }
  });

  await audit({
    action: AUDIT.schools.updated,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "school",
    targetId: schoolId,
    meta: { programFrom: before.map((row) => row.programId), programTo: programId },
  });
}

export async function setSchoolActive(
  ctx: SessionContext,
  schoolId: string,
  active: boolean,
): Promise<void> {
  requirePlatform(ctx);
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) throw new NotFoundError("School not found");

  await db.school.update({
    where: { id: schoolId },
    data: { status: active ? "ACTIVE" : "INACTIVE" },
  });
  await audit({
    action: active ? AUDIT.schools.reactivated : AUDIT.schools.deactivated,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "school",
    targetId: schoolId,
  });
}
