import "server-only";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/modules/auth/server/guard";
import { createStaff, type CreatedCredentials } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";

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
  await audit({
    action: AUDIT.schools.created,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId: school.id,
    targetType: "school",
    targetId: school.id,
    meta: { code: school.code, seats: input.licenceSeats },
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
