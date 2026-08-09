import { beforeAll, describe, expect, it } from "vitest";
import { APIError } from "better-auth/api";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AUDIT } from "@/lib/audit";
import { ConflictError } from "@/modules/auth/server/guard";
import {
  composeStudentUsername,
  createStaff,
  createStudent,
  resetPassword,
  setAccountDisabled,
} from "@/modules/auth/server/provisioning";
import {
  createTestSchool,
  SYSTEM_ACTOR,
  wipeDatabase,
} from "../helpers/fixtures";

/**
 * Provisioning + Better Auth round-trips (plan §0.1-1): accounts created by
 * our policy layer must actually sign in through the framework, and every
 * administrative action must leave an audit row. Uses auth.api server calls —
 * the same endpoints the HTTP handler exposes, minus cookies.
 */

let school: { id: string; code: string };

beforeAll(async () => {
  await wipeDatabase();
  const created = await createTestSchool("authrig");
  school = { id: created.id, code: created.code };
});

describe("student provisioning + username sign-in", () => {
  let studentUserId: string;
  let namespaced: string;
  let password: string;

  beforeAll(async () => {
    const created = await createStudent(SYSTEM_ACTOR, {
      schoolId: school.id,
      schoolCode: school.code,
      username: "zaid",
      displayName: "Zaid",
      studentIdentifier: "S-001",
      grade: 4,
    });
    studentUserId = created.userId;
    password = created.password;
    namespaced = composeStudentUsername(school.code, "zaid");
  });

  it("signs in with the namespaced username and generated password", async () => {
    const result = await auth.api.signInUsername({
      body: { username: namespaced, password },
    });
    expect(result?.token).toBeTruthy();
    expect(result?.user.id).toBe(studentUserId);
  });

  it("rejects a wrong password", async () => {
    await expect(
      auth.api.signInUsername({
        body: { username: namespaced, password: "totally-wrong-99" },
      }),
    ).rejects.toBeInstanceOf(APIError);
  });

  it("records a STUDENT_LOGIN learning event on successful sign-in", async () => {
    const event = await db.learningEvent.findFirst({
      where: { studentUserId, type: "STUDENT_LOGIN" },
    });
    expect(event).not.toBeNull();
    expect(event?.schoolId).toBe(school.id);
  });

  it("creates the StudentProfile and synthetic email correctly", async () => {
    const profile = await db.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    expect(profile?.schoolId).toBe(school.id);
    expect(profile?.studentIdentifier).toBe("S-001");
    expect(profile?.grade).toBe(4);

    const user = await db.user.findUnique({ where: { id: studentUserId } });
    // RFC 2606 reserved TLD: guaranteed undeliverable, obviously synthetic.
    expect(user?.email.endsWith(".invalid")).toBe(true);
  });

  it("rejects a duplicate username within the same school", async () => {
    await expect(
      createStudent(SYSTEM_ACTOR, {
        schoolId: school.id,
        schoolCode: school.code,
        username: "zaid",
        displayName: "Other Zaid",
        studentIdentifier: "S-002",
        grade: 5,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows the same username in another school (namespace isolation)", async () => {
    const other = await createTestSchool("authrigb");
    const created = await createStudent(SYSTEM_ACTOR, {
      schoolId: other.id,
      schoolCode: other.code,
      username: "zaid",
      displayName: "Zaid Elsewhere",
      studentIdentifier: "S-001",
      grade: 4,
    });
    expect(created.userId).toBeTruthy();
    const user = await db.user.findUnique({ where: { id: created.userId } });
    expect(user?.username).toBe(composeStudentUsername(other.code, "zaid"));
  });

  it("wrote an audit row for student creation", async () => {
    const row = await db.auditLog.findFirst({
      where: { action: AUDIT.students.created, targetId: studentUserId },
    });
    expect(row).not.toBeNull();
    expect(row?.schoolId).toBe(school.id);
  });
});

describe("staff provisioning + email sign-in", () => {
  it("forces a password change when no password is supplied", async () => {
    const created = await createStaff(SYSTEM_ACTOR, {
      schoolId: school.id,
      email: `${school.code}-nopass@test.example`,
      displayName: "Generated Pass Teacher",
      role: "TEACHER",
    });
    const user = await db.user.findUnique({ where: { id: created.userId } });
    expect(user?.mustChangePassword).toBe(true);
  });

  it("does not force a change when a password is supplied, and email sign-in works", async () => {
    const email = `${school.code}-admin@test.example`;
    const created = await createStaff(SYSTEM_ACTOR, {
      schoolId: school.id,
      email,
      displayName: "Seeded Admin",
      role: "SCHOOL_ADMIN",
      password: "seeded-pass-42",
    });
    const user = await db.user.findUnique({ where: { id: created.userId } });
    expect(user?.mustChangePassword).toBe(false);

    const result = await auth.api.signInEmail({
      body: { email, password: "seeded-pass-42" },
    });
    expect(result.token).toBeTruthy();
    expect(result.user.id).toBe(created.userId);

    const auditRow = await db.auditLog.findFirst({
      where: { action: AUDIT.staff.created, targetId: created.userId },
    });
    expect(auditRow).not.toBeNull();
  });
});

describe("password reset + account disable", () => {
  let teacherId: string;
  let email: string;
  let currentPassword: string;
  const initialPassword = "reset-me-77";

  beforeAll(async () => {
    email = `${school.code}-reset@test.example`;
    const created = await createStaff(SYSTEM_ACTOR, {
      schoolId: school.id,
      email,
      displayName: "Reset Target",
      role: "TEACHER",
      password: initialPassword,
    });
    teacherId = created.userId;
  });

  it("revokes sessions and swaps credentials on reset", async () => {
    // Establish a live session so revocation is observable.
    await auth.api.signInEmail({ body: { email, password: initialPassword } });
    expect(
      await db.session.count({ where: { userId: teacherId } }),
    ).toBeGreaterThanOrEqual(1);

    const { password: newPassword } = await resetPassword(SYSTEM_ACTOR, {
      userId: teacherId,
      schoolId: school.id,
      isStudent: false,
    });

    // Reset = every session row gone, before any new sign-in.
    expect(await db.session.count({ where: { userId: teacherId } })).toBe(0);

    await expect(
      auth.api.signInEmail({ body: { email, password: initialPassword } }),
    ).rejects.toBeInstanceOf(APIError);

    const result = await auth.api.signInEmail({
      body: { email, password: newPassword },
    });
    expect(result.token).toBeTruthy();
    currentPassword = newPassword;

    const auditRow = await db.auditLog.findFirst({
      where: { action: AUDIT.staff.passwordReset, targetId: teacherId },
    });
    expect(auditRow).not.toBeNull();
  });

  it("blocks sign-in for a disabled account and audits the change", async () => {
    await setAccountDisabled(
      SYSTEM_ACTOR,
      { userId: teacherId, schoolId: school.id, isStudent: false },
      true,
    );

    const user = await db.user.findUnique({ where: { id: teacherId } });
    expect(user?.banned).toBe(true);

    // The still-valid password proves the BAN is what blocks sign-in.
    await expect(
      auth.api.signInEmail({ body: { email, password: currentPassword } }),
    ).rejects.toBeInstanceOf(APIError);

    const auditRow = await db.auditLog.findFirst({
      where: { action: AUDIT.staff.disabled, targetId: teacherId },
    });
    expect(auditRow).not.toBeNull();
  });
});
