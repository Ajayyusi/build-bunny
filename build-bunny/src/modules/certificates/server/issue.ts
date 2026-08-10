import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";

/**
 * Certificate issuance (m4-contracts pinned interface). One entry point,
 * called from two places: the grading transaction path
 * (grading/server/submit.ts, on world completion) and the seed. Both must
 * see the SAME idempotent, self-validating behaviour — this module never
 * trusts a caller's claim that a world is "done"; it re-derives eligibility
 * from StudentProgress itself.
 *
 * "Genuine full-PASS" (plan §1.2: PARTIAL unlocks progression but never
 * earns a certificate) is checked via `stars >= 2` on every published level
 * of the world: stars are a high-water mark and computeStars (m3-contracts)
 * can only ever award 2–3 stars for a PASS verdict — PARTIAL always caps at
 * 1. That makes `stars >= 2` an exact, already-persisted proxy for "this
 * level was passed for real at some point", with no extra table to query.
 *
 * The threshold is `min(2, maxStars)` rather than a flat 2 so the proxy stays
 * exact for levels that award fewer stars than the standard scale. A Learn
 * step (CONCEPT_CARDS, maxStars 0 — it teaches rather than tests) can never
 * reach 2 stars, so a flat 2 would silently make every world containing one
 * uncertifiable. For the 3-star levels that are everything else, min(2, 3) is
 * 2 and nothing changes.
 */

export interface IssueResult {
  certificate: { id: string; serial: string; verifySlug: string } | null;
  alreadyIssued: boolean;
}

/** Crockford base32 (excludes I/L/O/U) — same alphabet the rest of the app uses for codes. */
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** "BB-2026-XXXXXX" — printed only, never a lookup key (m4-contracts). */
export function generateSerial(): string {
  const year = new Date().getFullYear();
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) code += CROCKFORD_ALPHABET[bytes[i]! % CROCKFORD_ALPHABET.length];
  return `BB-${year}-${code}`;
}

/** 22-char unguessable public lookup key (16 random bytes, base64url — no padding). */
export function generateVerifySlug(): string {
  return randomBytes(16).toString("base64url");
}

function asWorldTitle(name: unknown, fallback: string): LocalizedText {
  const parsed = localizedText.safeParse(name);
  return parsed.success ? parsed.data : { en: fallback };
}

const MAX_ISSUE_ATTEMPTS = 5;

async function findExisting(
  studentUserId: string,
  worldId: string,
): Promise<{ id: string; serial: string; verifySlug: string } | null> {
  return db.certificate.findUnique({
    where: {
      studentUserId_kind_worldId: {
        studentUserId,
        kind: "WORLD_COMPLETION",
        worldId,
      },
    },
    select: { id: true, serial: true, verifySlug: true },
  });
}

/**
 * Issues (or returns the already-issued) WORLD_COMPLETION certificate for a
 * student. Never throws for "not eligible yet" — that is an ordinary,
 * expected outcome (the caller in submit.ts wraps this in try/catch purely
 * for genuinely unexpected failures, per the task contract: issuance must
 * never break grading).
 */
export async function issueWorldCertificate(args: {
  schoolId: string;
  studentUserId: string;
  worldId: string;
}): Promise<IssueResult> {
  const { schoolId, studentUserId, worldId } = args;

  const existing = await findExisting(studentUserId, worldId);
  if (existing) return { certificate: existing, alreadyIssued: true };

  const world = await db.world.findUnique({
    where: { id: worldId },
    select: { id: true, slug: true, name: true, horizon: true },
  });
  if (!world || world.horizon) return { certificate: null, alreadyIssued: false };

  const publishedLevels = await db.level.findMany({
    where: { module: { worldId: world.id }, status: "PUBLISHED", publishedVersionId: { not: null } },
    select: { id: true, maxStars: true },
  });
  if (publishedLevels.length === 0) return { certificate: null, alreadyIssued: false };

  const progressRows = await db.studentProgress.findMany({
    where: {
      studentUserId,
      schoolId,
      status: "COMPLETED",
      levelId: { in: publishedLevels.map((l) => l.id) },
    },
    select: { levelId: true, stars: true },
  });
  const starsByLevel = new Map(progressRows.map((row) => [row.levelId, row.stars]));
  const fullyPassed = publishedLevels.every(
    (level) => (starsByLevel.get(level.id) ?? -1) >= Math.min(2, level.maxStars),
  );
  if (!fullyPassed) return { certificate: null, alreadyIssued: false };

  const [student, school] = await Promise.all([
    db.user.findFirst({
      where: { id: studentUserId, schoolId },
      select: { displayName: true },
    }),
    db.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
  ]);
  if (!student || !school) return { certificate: null, alreadyIssued: false };

  const starsEarned = progressRows.reduce((sum, row) => sum + row.stars, 0);
  const title = asWorldTitle(world.name, world.slug);

  for (let attempt = 0; attempt < MAX_ISSUE_ATTEMPTS; attempt++) {
    const serial = generateSerial();
    const verifySlug = generateVerifySlug();
    try {
      const created = await db.certificate.create({
        data: {
          schoolId,
          studentUserId,
          kind: "WORLD_COMPLETION",
          worldId: world.id,
          serial,
          verifySlug,
          studentName: student.displayName,
          schoolName: school.name,
          title: title as unknown as Prisma.InputJsonValue,
          starsEarned,
          levelsCount: publishedLevels.length,
        },
        select: { id: true, serial: true, verifySlug: true },
      });
      await audit({
        action: "certificates.issued",
        actorRole: "SYSTEM",
        schoolId,
        targetType: "certificate",
        targetId: created.id,
        meta: { studentUserId, worldId: world.id, worldSlug: world.slug },
      });
      return { certificate: created, alreadyIssued: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // A concurrent caller may have won the (student, kind, world) race —
        // check for that before assuming it was a serial/verifySlug clash.
        const race = await findExisting(studentUserId, worldId);
        if (race) return { certificate: race, alreadyIssued: true };
        continue; // vanishingly unlikely serial/verifySlug collision — retry
      }
      throw err;
    }
  }
  throw new Error(
    "issueWorldCertificate: exhausted retries generating a unique serial/verifySlug",
  );
}
