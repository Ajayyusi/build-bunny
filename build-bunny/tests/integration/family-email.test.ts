import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { setMailTransportForTests, type MailMessage, type MailResult } from "@/lib/mail";
import { createStaff, createStudent, setAccountDisabled } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  confirmFamilyEmail,
  familyEmailToken,
  getFamilyEmailPage,
  getFamilyEmailStatus,
  inviteFamilyEmailCore,
  isoWeek,
  readFamilyEmailToken,
  removeFamilyEmailCore,
  sendWeeklyFamilyEmails,
  stopFamilyEmail,
} from "@/modules/family/server/email";
import { submitAttempt } from "@/modules/grading/server/submit";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import { POST as familyEmailRoute } from "@/app/api/family/email/route";
import { GET as cronRoute } from "@/app/api/cron/family-email/route";
import {
  addWorldToProgram,
  createCtx,
  createTestLevel,
  createTestModule,
  createTestProgram,
  createTestSchool,
  enableProgramForSchool,
  SYSTEM_ACTOR,
  wipeDatabase,
} from "../helpers/fixtures";

/**
 * The weekly family email against real rows, with the mail transport
 * swapped for a recorder: nothing here can reach Resend. Covers the privacy
 * promises: nothing about the child before the family confirms, one-click
 * stop, removal, disabling, and never twice in one week.
 */

type Node = Record<string, unknown>;
const program = (...types: string[]): unknown => {
  let next: Node | undefined;
  for (let i = types.length - 1; i >= 0; i -= 1) {
    const block: Node = { type: types[i], id: `b${i}` };
    if (next) block["next"] = { block: next };
    next = block;
  }
  return {
    blocks: { languageVersion: 0, blocks: [{ type: "bb_whenStart", id: "hat", ...(next ? { next: { block: next } } : {}) }] },
  };
};
const PAYLOAD = {
  toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnRight" }],
  variants: [{ rows: ["..G", "#.."], start: { x: 0, y: 0, dir: "E" } }],
  checks: [{ id: "reachedGoal", severity: "core" }],
  starCriteria: { threeStarMaxBlocks: 2 },
};
const PASS = program("bb_moveForward", "bb_moveForward");

let sent: MailMessage[] = [];
let failNext = false;
let restore: () => void;

let teacherCtx: SessionContext;
let otherTeacherCtx: SessionContext;
let schoolId: string;
let levelId: string;
const kids: { id: string; ctx: SessionContext }[] = [];

const tokenFrom = (message: MailMessage): string => {
  const match = /\/family\/email\/([A-Za-z0-9._-]+)/.exec(message.text);
  if (!match) throw new Error("no family email link in message");
  return match[1]!;
};

beforeAll(async () => {
  restore = setMailTransportForTests(async (message): Promise<MailResult> => {
    if (failNext) {
      failNext = false;
      return { ok: false, error: "simulated" };
    }
    sent.push(message);
    return { ok: true, id: `fake-${sent.length}` };
  });

  await wipeDatabase();
  const school = await createTestSchool("Family Mail");
  schoolId = school.id;
  const teacher = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-t@test.example`,
    displayName: "Mail Teacher",
    role: "TEACHER",
    password: "teach-pass-21",
  });
  const other = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-o@test.example`,
    displayName: "Other Teacher",
    role: "TEACHER",
    password: "teach-pass-22",
  });
  const year = await db.academicYear.create({
    data: { schoolId, name: "2026-2027", startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-06-30T00:00:00Z") },
  });
  const cls = await db.class.create({ data: { schoolId, academicYearId: year.id, name: "4A", grade: 4 } });
  await db.classMembership.create({ data: { schoolId, classId: cls.id, userId: teacher.userId, role: "TEACHER" } });

  const prog = await createTestProgram({ name: "Mail Program" });
  const world = await addWorldToProgram(prog.id, 1, { name: "Mail World" });
  const mod = await createTestModule(world.id, 1);
  levelId = (await createTestLevel(mod.id, 1, { title: "Two Hops", payload: PAYLOAD, tags: ["sequencing"] })).id;
  await enableProgramForSchool(schoolId, prog.id);

  for (const [i, name] of ["noor", "omar", "lina"].entries()) {
    const student = await createStudent(SYSTEM_ACTOR, {
      schoolId,
      schoolCode: school.code,
      username: `${name}mail`,
      displayName: `${name[0]!.toUpperCase()}${name.slice(1)} Q.`,
      studentIdentifier: `FM-${i}`,
      grade: 4,
    });
    await db.classMembership.create({ data: { schoolId, classId: cls.id, userId: student.userId, role: "STUDENT" } });
    await recomputeUnlocks(student.userId);
    kids.push({ id: student.userId, ctx: createCtx({ userId: student.userId, role: "STUDENT", schoolId }) });
  }
  teacherCtx = createCtx({ userId: teacher.userId, role: "TEACHER", schoolId });
  otherTeacherCtx = createCtx({ userId: other.userId, role: "TEACHER", schoolId });

  // Noor and Omar play this week; Lina doesn't.
  for (const kid of kids.slice(0, 2)) {
    const result = await submitAttempt(kid.ctx, levelId, { attemptRunId: randomUUID(), workspaceJson: PASS });
    expect(result.status).toBe(200);
  }
});

afterAll(() => restore());

beforeEach(() => {
  sent = [];
  failNext = false;
});

describe("family email invitation", () => {
  it("only the child's own teacher may add an address, and not while viewing as someone else", async () => {
    await expect(
      inviteFamilyEmailCore(otherTeacherCtx, { studentUserId: kids[0]!.id, email: "a@family.example", locale: "en" }),
    ).rejects.toThrow();
    await expect(
      inviteFamilyEmailCore({ ...teacherCtx, impersonatedBy: "platform-admin" }, {
        studentUserId: kids[0]!.id,
        email: "a@family.example",
        locale: "en",
      }),
    ).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });

  it("invites without naming the child, and sends nothing more until confirmed", async () => {
    const result = await inviteFamilyEmailCore(teacherCtx, {
      studentUserId: kids[0]!.id,
      email: "  Noor.Family@Example.COM ",
      locale: "en",
    });
    expect(result.state).toBe("pending");
    expect(sent).toHaveLength(1);
    const invite = sent[0]!;
    expect(invite.to).toBe("noor.family@example.com");
    expect(invite.html + invite.text + invite.subject).not.toContain("Noor");
    expect(invite.text).toContain("Family Mail");

    const status = await getFamilyEmailStatus(teacherCtx, kids[0]!.id);
    expect(status).toMatchObject({ state: "pending", email: "noor.family@example.com" });
    // The page names the school but still not the child.
    const page = await getFamilyEmailPage(tokenFrom(invite));
    expect(page).toMatchObject({ state: "pending", displayName: null });

    // Unconfirmed: the weekly run skips it.
    const run = await sendWeeklyFamilyEmails(new Date(), { pauseMs: 0 });
    expect(run.sent).toBe(0);
    expect(sent).toHaveLength(1);

    // Asking again within minutes sends nothing new.
    await inviteFamilyEmailCore(teacherCtx, { studentUserId: kids[0]!.id, email: "noor.family@example.com", locale: "en" });
    expect(sent).toHaveLength(1);
  });

  it("a forged or altered link does nothing", async () => {
    const row = await db.familyEmail.findFirstOrThrow({ where: { studentUserId: kids[0]!.id } });
    const token = familyEmailToken(row.id);
    expect(readFamilyEmailToken(token)).toBe(row.id);
    const altered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(readFamilyEmailToken(altered)).toBeNull();
    expect(await confirmFamilyEmail(altered)).toBe(false);
    expect(await confirmFamilyEmail("../../etc")).toBe(false);
    expect((await db.familyEmail.findUniqueOrThrow({ where: { id: row.id } })).confirmedAt).toBeNull();
  });

  it("a failed send leaves the address that was there before", async () => {
    failNext = true;
    await expect(
      inviteFamilyEmailCore(teacherCtx, { studentUserId: kids[0]!.id, email: "typo@example.com", locale: "en" }),
    ).rejects.toThrow();
    expect(await getFamilyEmailStatus(teacherCtx, kids[0]!.id)).toMatchObject({ email: "noor.family@example.com" });
  });
});

describe("weekly run", () => {
  it("after confirming, the family gets the week, with a one-click stop, once a week", async () => {
    const row = await db.familyEmail.findFirstOrThrow({ where: { studentUserId: kids[0]!.id } });
    expect(await confirmFamilyEmail(familyEmailToken(row.id))).toBe(true);
    expect(await getFamilyEmailPage(familyEmailToken(row.id))).toMatchObject({ state: "active", displayName: "Noor Q." });

    const now = new Date();
    const run = await sendWeeklyFamilyEmails(now, { pauseMs: 0 });
    expect(run).toMatchObject({ configured: true, due: 1, sent: 1 });
    const weekly = sent[0]!;
    expect(weekly.to).toBe("noor.family@example.com");
    expect(weekly.subject).toBe("Noor Q.'s week in Build Bunny");
    expect(weekly.text).toContain("Two Hops");
    expect(weekly.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(weekly.headers?.["List-Unsubscribe"]).toContain(familyEmailToken(row.id));
    expect(weekly.idempotencyKey).toBe(`family-weekly:${row.id}:${isoWeek(now)}`);
    // Nothing about another child, attempts or hints.
    expect(weekly.html + weekly.text).not.toContain("Omar");
    expect(weekly.text.toLowerCase()).not.toContain("hint");

    // Friday's run doesn't repeat Thursday's.
    const again = await sendWeeklyFamilyEmails(new Date(now.getTime() + 24 * 60 * 60 * 1000), { pauseMs: 0 });
    expect(again.sent).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("skips a quiet week", async () => {
    await inviteFamilyEmailCore(teacherCtx, { studentUserId: kids[2]!.id, email: "lina@family.example", locale: "ar" });
    const row = await db.familyEmail.findFirstOrThrow({ where: { studentUserId: kids[2]!.id } });
    await confirmFamilyEmail(familyEmailToken(row.id));
    sent = [];
    const run = await sendWeeklyFamilyEmails(new Date(), { pauseMs: 0 });
    expect(run.quiet).toBe(1);
    expect(sent.some((message) => message.to === "lina@family.example")).toBe(false);
  });

  it("stopping from the email's one-click link ends it at once", async () => {
    const row = await db.familyEmail.findFirstOrThrow({ where: { studentUserId: kids[0]!.id } });
    const token = familyEmailToken(row.id);
    const response = await familyEmailRoute(
      new NextRequest(`http://localhost/api/family/email?intent=stop&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );
    expect(response.status).toBe(200);
    expect(await getFamilyEmailStatus(teacherCtx, kids[0]!.id)).toMatchObject({ state: "stopped" });
    // Stopped stays stopped: the old confirm link can't switch it back on.
    expect(await confirmFamilyEmail(token)).toBe(false);
    const later = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const run = await sendWeeklyFamilyEmails(later, { pauseMs: 0 });
    expect(sent.some((message) => message.to === "noor.family@example.com")).toBe(false);
    expect(run.sent).toBe(0);
  });

  it("the page's buttons post a form and come back to the page", async () => {
    await inviteFamilyEmailCore(teacherCtx, { studentUserId: kids[1]!.id, email: "omar@family.example", locale: "en" });
    const token = tokenFrom(sent[0]!);
    const form = new FormData();
    form.set("token", token);
    form.set("intent", "confirm");
    form.set("locale", "en");
    const response = await familyEmailRoute(new NextRequest("http://localhost/api/family/email", { method: "POST", body: form }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`http://localhost/en/family/email/${token}`);
    expect(await getFamilyEmailStatus(teacherCtx, kids[1]!.id)).toMatchObject({ state: "active" });
    await stopFamilyEmail(token);
  });
});

describe("removing, replacing and disabling", () => {
  it("a new address retires every link sent to the old one", async () => {
    const before = await db.familyEmail.findFirstOrThrow({ where: { studentUserId: kids[1]!.id } });
    const oldToken = familyEmailToken(before.id);
    await inviteFamilyEmailCore(teacherCtx, { studentUserId: kids[1]!.id, email: "omar.dad@family.example", locale: "en" });
    expect(await getFamilyEmailPage(oldToken)).toBeNull();
    expect(await confirmFamilyEmail(oldToken)).toBe(false);
  });

  it("an invitation lapses after 14 days", async () => {
    const row = await db.familyEmail.findFirstOrThrow({ where: { studentUserId: kids[1]!.id } });
    const later = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    expect(await confirmFamilyEmail(familyEmailToken(row.id), later)).toBe(false);
    expect(await getFamilyEmailStatus(teacherCtx, kids[1]!.id, later)).toMatchObject({ state: "none", email: null });
  });

  it("removing deletes the address", async () => {
    await removeFamilyEmailCore(teacherCtx, { studentUserId: kids[1]!.id });
    expect(await db.familyEmail.count({ where: { studentUserId: kids[1]!.id } })).toBe(0);
    // The address never reaches the audit log.
    const logs = await db.auditLog.findMany({ where: { action: { startsWith: "family_email." } } });
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain("@family.example");
  });

  it("disabling a child deletes the family's address", async () => {
    expect(await db.familyEmail.count({ where: { studentUserId: kids[2]!.id } })).toBe(1);
    await setAccountDisabled(SYSTEM_ACTOR, { userId: kids[2]!.id, schoolId, isStudent: true }, true);
    expect(await db.familyEmail.count({ where: { studentUserId: kids[2]!.id } })).toBe(0);
    await setAccountDisabled(SYSTEM_ACTOR, { userId: kids[2]!.id, schoolId, isStudent: true }, false);
  });
});

describe("cron route", () => {
  it("refuses a call without the cron secret", async () => {
    const response = await cronRoute(new NextRequest("http://localhost/api/cron/family-email"));
    expect(response.status).toBe(401);
  });
});
