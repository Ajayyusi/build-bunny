import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import {
  generateSerial,
  generateVerifySlug,
  issueWorldCertificate,
} from "@/modules/certificates/server/issue";
import { verifyCertificate } from "@/modules/certificates/server/verify";
import {
  addWorldToProgram,
  createTestLevel,
  createTestModule,
  createTestProgram,
  createTestSchool,
  enableProgramForSchool,
  SYSTEM_ACTOR,
  wipeDatabase,
} from "../helpers/fixtures";

/**
 * Certificate issuance + public verification (m4 task 2). Progress rows are
 * written directly (not through the grading pipeline — that path is proven
 * end-to-end in grading.test.ts and wired to issuance in submit.ts) so these
 * tests isolate issueWorldCertificate's own eligibility logic: every
 * published level of the world must be genuinely PASSed (stars >= 2), not
 * just PARTIAL-completed (which computeStars always caps at 1 star, m3
 * -contracts) — "world completion... will require full PASS on every level."
 */

let schoolId: string;
let worldId: string;
let levelAId: string;
let levelBId: string;
let studentUserId: string;

async function completeLevel(
  userId: string,
  levelId: string,
  stars: number,
): Promise<void> {
  await db.studentProgress.upsert({
    where: { studentUserId_levelId: { studentUserId: userId, levelId } },
    create: {
      schoolId,
      studentUserId: userId,
      levelId,
      status: "COMPLETED",
      stars,
      attemptsCount: 1,
      unlockSource: "ORDER",
      firstCompletedAt: new Date(),
      lastActivityAt: new Date(),
      completedVersion: 1,
    },
    update: { status: "COMPLETED", stars },
  });
}

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Cert");
  schoolId = school.id;

  const program = await createTestProgram({ name: "Certificates Program" });
  const world = await addWorldToProgram(program.id, 1, { name: "Certificate World" });
  worldId = world.id;
  const mod = await createTestModule(world.id, 1);
  const levelA = await createTestLevel(mod.id, 1, { title: "Level A" });
  const levelB = await createTestLevel(mod.id, 2, { title: "Level B" });
  levelAId = levelA.id;
  levelBId = levelB.id;
  await enableProgramForSchool(schoolId, program.id);

  const student = await createStudent(SYSTEM_ACTOR, {
    schoolId,
    schoolCode: school.code,
    username: "certstudent",
    displayName: "Cert Student",
    studentIdentifier: "CERT-001",
    grade: 4,
  });
  studentUserId = student.userId;
});

describe("generateSerial / generateVerifySlug", () => {
  it("serial matches BB-{year}-{6 Crockford base32 chars}", () => {
    const serial = generateSerial();
    expect(serial).toMatch(/^BB-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it("verifySlug is a 22-character unguessable key, unique across calls", () => {
    const slugs = new Set(Array.from({ length: 20 }, () => generateVerifySlug()));
    expect(slugs.size).toBe(20);
    for (const slug of slugs) {
      expect(slug).toHaveLength(22);
      expect(slug).toMatch(/^[A-Za-z0-9_-]{22}$/);
    }
  });
});

describe("issueWorldCertificate — eligibility", () => {
  it("does not issue when levels are incomplete", async () => {
    const result = await issueWorldCertificate({ schoolId, studentUserId, worldId });
    expect(result).toEqual({ certificate: null, alreadyIssued: false });
    expect(await db.certificate.count({ where: { studentUserId, worldId } })).toBe(0);
  });

  it("does not issue when a level was only PARTIAL-completed (1 star), even though it's COMPLETED", async () => {
    await completeLevel(studentUserId, levelAId, 2);
    await completeLevel(studentUserId, levelBId, 1); // PARTIAL caps at 1 star (m3-contracts)

    const result = await issueWorldCertificate({ schoolId, studentUserId, worldId });
    expect(result).toEqual({ certificate: null, alreadyIssued: false });
    expect(await db.certificate.count({ where: { studentUserId, worldId } })).toBe(0);
  });

  it("does not issue for a horizon world", async () => {
    const program = await createTestProgram({ name: "Horizon Program" });
    const horizonWorld = await addWorldToProgram(program.id, 1, { horizon: true });
    const result = await issueWorldCertificate({
      schoolId,
      studentUserId,
      worldId: horizonWorld.id,
    });
    expect(result).toEqual({ certificate: null, alreadyIssued: false });
  });

  it("does not issue for an unknown world id", async () => {
    const result = await issueWorldCertificate({
      schoolId,
      studentUserId,
      worldId: "no-such-world",
    });
    expect(result).toEqual({ certificate: null, alreadyIssued: false });
  });
});

describe("issueWorldCertificate — genuine full-PASS issuance + idempotency", () => {
  it("issues once every level is genuinely PASSed (stars >= 2 on all)", async () => {
    await completeLevel(studentUserId, levelBId, 3); // upgrade the PARTIAL to a real PASS

    const first = await issueWorldCertificate({ schoolId, studentUserId, worldId });
    expect(first.alreadyIssued).toBe(false);
    expect(first.certificate).not.toBeNull();
    expect(first.certificate!.serial).toMatch(/^BB-\d{4}-/);
    expect(first.certificate!.verifySlug).toHaveLength(22);

    expect(await db.certificate.count({ where: { studentUserId, worldId } })).toBe(1);
    const row = await db.certificate.findUniqueOrThrow({ where: { id: first.certificate!.id } });
    expect(row.kind).toBe("WORLD_COMPLETION");
    expect(row.studentName).toBe("Cert Student");
    expect(row.starsEarned).toBe(5); // 2 + 3
    expect(row.levelsCount).toBe(2);
  });

  it("a second call returns the SAME certificate as alreadyIssued and creates no duplicate row", async () => {
    const second = await issueWorldCertificate({ schoolId, studentUserId, worldId });
    expect(second.alreadyIssued).toBe(true);

    const first = await db.certificate.findFirstOrThrow({ where: { studentUserId, worldId } });
    expect(second.certificate).toEqual({
      id: first.id,
      serial: first.serial,
      verifySlug: first.verifySlug,
    });
    expect(await db.certificate.count({ where: { studentUserId, worldId } })).toBe(1);
  });
});

describe("verifyCertificate — public, safe-field-only", () => {
  it("returns exactly the PublicCertificate field set — no internal ids", async () => {
    const cert = await db.certificate.findFirstOrThrow({ where: { studentUserId, worldId } });
    const result = await verifyCertificate(cert.verifySlug);
    expect(result).not.toBeNull();

    expect(Object.keys(result!).sort()).toEqual(
      [
        "valid",
        "revoked",
        "studentName",
        "schoolName",
        "title",
        "issuedAt",
        "serial",
        "starsEarned",
        "levelsCount",
      ].sort(),
    );
    const json = JSON.stringify(result);
    expect(json).not.toContain(studentUserId);
    expect(json).not.toContain(schoolId);
    expect(json).not.toContain(worldId);
    expect(json).not.toContain(cert.id);

    expect(result).toMatchObject({
      valid: true,
      revoked: false,
      studentName: "Cert Student",
      starsEarned: 5,
      levelsCount: 2,
      serial: cert.serial,
    });
  });

  it("the printed serial is NOT accepted as a verify key", async () => {
    const cert = await db.certificate.findFirstOrThrow({ where: { studentUserId, worldId } });
    expect(await verifyCertificate(cert.serial)).toBeNull();
  });

  it("an unknown slug returns null — indistinguishable from an 'almost right' one", async () => {
    expect(await verifyCertificate("this-slug-does-not-exist-anywhere")).toBeNull();
    const cert = await db.certificate.findFirstOrThrow({ where: { studentUserId, worldId } });
    const almost = cert.verifySlug.slice(0, -1) + (cert.verifySlug.endsWith("A") ? "B" : "A");
    expect(await verifyCertificate(almost)).toBeNull();
  });

  it("reflects the revoked state once a certificate is revoked", async () => {
    const cert = await db.certificate.findFirstOrThrow({ where: { studentUserId, worldId } });
    await db.certificate.update({
      where: { id: cert.id },
      data: { revokedAt: new Date(), revokeReason: "test revocation" },
    });

    const result = await verifyCertificate(cert.verifySlug);
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(false);
    expect(result!.revoked).toBe(true);
    // Revocation still resolves — it is not treated as "not found".
    expect(result!.serial).toBe(cert.serial);
  });
});
