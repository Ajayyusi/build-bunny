import "server-only";

import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import type { Role } from "@/modules/auth/roles";
import { ConflictError } from "@/modules/auth/server/guard";

/**
 * Build Bunny's custom identity layer (plan §0.1-1). Security primitives stay
 * framework-owned: passwords are hashed with Better Auth's own crypto (scrypt),
 * sign-in/sessions/cookies/CSRF/throttling run entirely through Better Auth.
 * This module owns ONLY provisioning policy: school-scoped usernames,
 * generated child-friendly passwords, forced password change, account
 * disabling, and the audit trail of account administration.
 *
 * Public self-signup is disabled — accounts exist only through these functions
 * (called from permission-guarded server actions and the seed pipeline).
 *
 * Username model: students sign in with (school code, username). We store the
 * username namespaced as `{schoolCode}__{username}` so the global unique
 * column enforces per-school uniqueness. Staff sign in with email.
 *
 * Students get NO email — a synthetic, undeliverable address satisfies the
 * framework's non-null email column and is never shown anywhere.
 */

export function composeStudentUsername(schoolCode: string, username: string): string {
  return `${schoolCode.trim().toLowerCase()}__${username.trim().toLowerCase()}`;
}

export function syntheticStudentEmail(namespacedUsername: string): string {
  // .invalid is reserved (RFC 2606): guaranteed undeliverable, obviously synthetic.
  return `${namespacedUsername}@student.buildbunny.invalid`;
}

/** Child-friendly generated password: word-word-NN (readable, typeable at 8). */
const PASSWORD_WORDS = [
  "apple", "bunny", "cloud", "daisy", "eagle", "frog", "grape", "honey",
  "island", "jelly", "kite", "lemon", "mango", "nest", "olive", "panda",
  "quest", "river", "star", "tiger", "umbrella", "violet", "whale", "yoyo",
  "zebra", "acorn", "breeze", "coral", "dune", "ember", "fern", "glow",
] as const;

export function generateFriendlyPassword(): string {
  const a = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)];
  const b = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)];
  const n = randomInt(10, 100);
  return `${a}-${b}-${n}`;
}

/** Better Auth credential-account convention: providerId "credential". */
export const CREDENTIAL_PROVIDER = "credential";

interface Actor {
  userId: string;
  role: Role | "SYSTEM";
}

export interface CreateStudentInput {
  schoolId: string;
  schoolCode: string;
  username: string;
  displayName: string;
  studentIdentifier: string;
  grade: number;
  locale?: string;
  /** Deterministic password for demo seeds only; generated when omitted. */
  password?: string;
}

export interface CreatedCredentials {
  userId: string;
  username: string;
  password: string;
}

/**
 * Create a student account + profile. Returns the generated password exactly
 * once — it is never stored in plaintext anywhere.
 */
export async function createStudent(
  actor: Actor,
  input: CreateStudentInput,
  /**
   * Transaction client, so callers can make the seat check, the user insert
   * and the class membership one atomic step. Defaults to the plain client
   * for callers with nothing to join.
   */
  client: Prisma.TransactionClient | typeof db = db,
): Promise<CreatedCredentials> {
  const displayUsername = input.username.trim().toLowerCase();
  const namespaced = composeStudentUsername(input.schoolCode, input.username);
  const password = input.password ?? generateFriendlyPassword();

  const existing = await client.user.findUnique({ where: { username: namespaced } });
  if (existing) {
    throw new ConflictError(`Username "${displayUsername}" is already taken in this school`);
  }

  const passwordHash = await hashPassword(password);

  const user = await client.user.create({
    data: {
      name: input.displayName,
      email: syntheticStudentEmail(namespaced),
      emailVerified: false,
      username: namespaced,
      displayUsername,
      role: "STUDENT",
      schoolId: input.schoolId,
      displayName: input.displayName,
      locale: input.locale ?? "en",
      mustChangePassword: false, // young students keep generated credentials
      accounts: {
        create: {
          providerId: CREDENTIAL_PROVIDER,
          accountId: syntheticStudentEmail(namespaced),
          password: passwordHash,
        },
      },
      studentProfile: {
        create: {
          schoolId: input.schoolId,
          studentIdentifier: input.studentIdentifier,
          grade: input.grade,
        },
      },
    },
  });

  await audit({
    action: AUDIT.students.created,
    actorUserId: actor.userId,
    actorRole: actor.role,
    schoolId: input.schoolId,
    targetType: "user",
    targetId: user.id,
  });

  return { userId: user.id, username: displayUsername, password };
}

export interface CreateStaffInput {
  schoolId: string | null; // null for platform staff
  email: string;
  displayName: string;
  role: Exclude<Role, "STUDENT">;
  title?: string;
  /** Deterministic password for demo seeds only; generated when omitted. */
  password?: string;
}

export async function createStaff(
  actor: Actor,
  input: CreateStaffInput,
): Promise<CreatedCredentials> {
  const email = input.email.trim().toLowerCase();
  const password = input.password ?? generateFriendlyPassword();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError(`An account already exists for ${email}`);

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      name: input.displayName,
      email,
      emailVerified: false,
      role: input.role,
      schoolId: input.schoolId,
      displayName: input.displayName,
      // Staff must set their own password on first login (unless seeded).
      mustChangePassword: input.password === undefined,
      accounts: {
        create: {
          providerId: CREDENTIAL_PROVIDER,
          accountId: email,
          password: passwordHash,
        },
      },
      ...(input.role === "TEACHER" && input.schoolId
        ? {
            teacherProfile: {
              create: { schoolId: input.schoolId, title: input.title ?? null },
            },
          }
        : {}),
    },
  });

  await audit({
    action: AUDIT.staff.created,
    actorUserId: actor.userId,
    actorRole: actor.role,
    schoolId: input.schoolId,
    targetType: "user",
    targetId: user.id,
    meta: { role: input.role },
  });

  return { userId: user.id, username: email, password };
}

/**
 * Teacher/admin resets a password: fresh friendly password, every existing
 * session revoked, staff forced to change on next login. The CALLER is
 * responsible for the tenant check (data layer scopes target lookup).
 */
export async function resetPassword(
  actor: Actor,
  target: { userId: string; schoolId: string | null; isStudent: boolean },
): Promise<{ password: string }> {
  const password = generateFriendlyPassword();
  const passwordHash = await hashPassword(password);

  await db.$transaction([
    db.account.updateMany({
      where: { userId: target.userId, providerId: CREDENTIAL_PROVIDER },
      data: { password: passwordHash },
    }),
    // Session revocation = deleting the framework's session rows.
    db.session.deleteMany({ where: { userId: target.userId } }),
    db.user.update({
      where: { id: target.userId },
      data: { mustChangePassword: !target.isStudent },
    }),
  ]);

  await audit({
    action: target.isStudent ? AUDIT.students.passwordReset : AUDIT.staff.passwordReset,
    actorUserId: actor.userId,
    actorRole: actor.role,
    schoolId: target.schoolId,
    targetType: "user",
    targetId: target.userId,
  });

  return { password };
}

/** Disable an account (framework ban field) and revoke all sessions. */
export async function setAccountDisabled(
  actor: Actor,
  target: { userId: string; schoolId: string | null; isStudent: boolean },
  disabled: boolean,
): Promise<void> {
  await db.$transaction([
    db.user.update({
      where: { id: target.userId },
      data: disabled
        ? { banned: true, banReason: "Account disabled by your school" }
        : { banned: false, banReason: null, banExpires: null },
    }),
    ...(disabled ? [db.session.deleteMany({ where: { userId: target.userId } })] : []),
  ]);

  const group = target.isStudent ? AUDIT.students : AUDIT.staff;
  await audit({
    action: disabled ? group.disabled : group.enabled,
    actorUserId: actor.userId,
    actorRole: actor.role,
    schoolId: target.schoolId,
    targetType: "user",
    targetId: target.userId,
  });
}
