import { randomUUID as uuid } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { getClassAiIdeas, getSchoolAnalytics } from "@/modules/analytics/server/queries";
import { NotFoundError } from "@/modules/auth/server/guard";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { submitAttempt } from "@/modules/grading/server/submit";
import { computeAdventureState } from "@/modules/learning/server/adventure";
import { recordPlayEventCore, SESSION_GAP_MS } from "@/modules/learning/server/play-events";
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
 * The handoff's AI analytics — start, test, retry, completion — against real
 * rows: what gets recorded (in the browser and on the server), and what the
 * teacher and the school admin read back. Counts only.
 */

const trend = {
  widget: {
    widgetId: "trend-line",
    xAxis: { en: "x" },
    yAxis: { en: "y" },
    toleranceFactor: 1.6,
    predictAt: 7,
    points: [1, 2, 3, 4, 5].map((x) => ({ x, y: 2 * x + (x % 2 === 0 ? 0.3 : -0.3) })),
  },
  intro: { en: "Fit it." },
  honesty: { kind: "REAL", note: { en: "Real." } },
};

let kid: SessionContext;
let other: SessionContext;
let viewing: SessionContext;
let teacher: SessionContext;
let admin: SessionContext;
let classId: string;
let levelId: string;
let lockedId: string;

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("AI Analytics");
  const program = await createTestProgram({ name: "AI" });
  const world = await addWorldToProgram(program.id, 1, { name: "Data" });
  const mod = await createTestModule(world.id, 1);
  const level = await createTestLevel(mod.id, 1, { activityType: "AI_SIM", track: "AI_CONCEPTS", payload: trend });
  // In the AI ideas catalog, so the teacher panel shows it.
  await db.level.update({ where: { id: level.id }, data: { slug: "fortune-teller" } });
  levelId = level.id;
  lockedId = (await createTestLevel(mod.id, 2, { activityType: "AI_SIM", track: "AI_CONCEPTS", payload: trend })).id;
  await enableProgramForSchool(school.id, program.id);

  const t = await createStaff(SYSTEM_ACTOR, {
    schoolId: school.id,
    email: `${school.code}-t@test.example`,
    displayName: "Teacher",
    role: "TEACHER",
    password: "teach-pass-41",
  });
  const a = await createStaff(SYSTEM_ACTOR, {
    schoolId: school.id,
    email: `${school.code}-a@test.example`,
    displayName: "Admin",
    role: "SCHOOL_ADMIN",
    password: "admin-pass-41",
  });
  const year = await db.academicYear.create({
    data: { schoolId: school.id, name: "2026-2027", startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-06-30T00:00:00Z") },
  });
  const cls = await db.class.create({ data: { schoolId: school.id, academicYearId: year.id, name: "5A", grade: 5 } });
  classId = cls.id;
  await db.classMembership.create({ data: { schoolId: school.id, classId, userId: t.userId, role: "TEACHER" } });
  const kids: SessionContext[] = [];
  for (const name of ["hala", "omar"]) {
    const s = await createStudent(SYSTEM_ACTOR, {
      schoolId: school.id,
      schoolCode: school.code,
      username: `${name}ai`,
      displayName: name,
      studentIdentifier: `AI-${name}`,
      grade: 5,
    });
    await db.classMembership.create({ data: { schoolId: school.id, classId, userId: s.userId, role: "STUDENT" } });
    const ctx = createCtx({ userId: s.userId, role: "STUDENT", schoolId: school.id });
    await computeAdventureState(ctx);
    kids.push(ctx);
  }
  [kid, other] = kids as [SessionContext, SessionContext];
  viewing = { ...other, impersonatedBy: "platform-admin" };
  teacher = createCtx({ userId: t.userId, role: "TEACHER", schoolId: school.id });
  admin = createCtx({ userId: a.userId, role: "SCHOOL_ADMIN", schoolId: school.id });
});

const count = (ctx: SessionContext, type: "LEVEL_SESSION_STARTED" | "AI_TEST" | "AI_RETRY") =>
  db.learningEvent.count({ where: { studentUserId: ctx.userId, levelId, type } });

describe("recording", () => {
  it("records a start on every session, but not on every reload", async () => {
    const now = new Date();
    expect(await recordPlayEventCore(kid, levelId, { kind: "start" }, now)).toEqual({ recorded: true });
    expect(await recordPlayEventCore(kid, levelId, { kind: "start" }, now)).toEqual({ recorded: false });
    expect(await count(kid, "LEVEL_SESSION_STARTED")).toBe(1);
    // The next session, after the gap.
    await db.learningEvent.updateMany({
      where: { studentUserId: kid.userId, type: "LEVEL_SESSION_STARTED" },
      data: { createdAt: new Date(now.getTime() - SESSION_GAP_MS - 1000) },
    });
    expect(await recordPlayEventCore(kid, levelId, { kind: "start" }, now)).toEqual({ recorded: true });
    expect(await count(kid, "LEVEL_SESSION_STARTED")).toBe(2);
  });

  it("records in-browser tests and retries, as small codes", async () => {
    await recordPlayEventCore(kid, levelId, { kind: "test", what: "computerTurn" });
    await recordPlayEventCore(kid, levelId, { kind: "retry", what: "moveLineAgain" });
    const test = await db.learningEvent.findFirstOrThrow({ where: { studentUserId: kid.userId, type: "AI_TEST" } });
    expect(test.meta).toEqual({ what: "computerTurn" });
    expect(await count(kid, "AI_RETRY")).toBe(1);
  });

  it("a graded check after a failed one is a retry", async () => {
    const fail = await submitAttempt(kid, levelId, {
      attemptRunId: uuid(),
      answer: { line: { slope: -5, intercept: 40 }, prediction: 3 },
    });
    expect((fail.body as { verdict: string }).verdict).toBe("FAIL");
    expect(await count(kid, "AI_RETRY")).toBe(1);
    const pass = await submitAttempt(kid, levelId, {
      attemptRunId: uuid(),
      answer: { line: { slope: 2, intercept: 0 }, prediction: 14 },
    });
    expect((pass.body as { verdict: string }).verdict).toBe("PASS");
    expect(await count(kid, "AI_RETRY")).toBe(2);
    const retry = await db.learningEvent.findFirstOrThrow({
      where: { studentUserId: kid.userId, type: "AI_RETRY" },
      orderBy: { createdAt: "desc" },
    });
    expect(retry.meta).toEqual({ what: "check" });
  });

  it("refuses a level the child can't open, and records nothing while viewing as a child", async () => {
    // Level 2 opens only after level 1, which the other child hasn't finished.
    await expect(recordPlayEventCore(other, lockedId, { kind: "start" })).rejects.toThrow(NotFoundError);
    expect(await recordPlayEventCore(viewing, levelId, { kind: "test", what: "choice" })).toEqual({ recorded: false });
    expect(await count(other, "AI_TEST")).toBe(0);
  });
});

describe("reading it back", () => {
  it("the teacher sees class totals per AI idea", async () => {
    await recordPlayEventCore(other, levelId, { kind: "start" });
    const ideas = await getClassAiIdeas(teacher, classId);
    const idea = ideas?.ideas.find((i) => i.levelId === levelId);
    // Starts: 2 sessions + 1 for the other child (+ the first-open LEVEL_STARTED rows, if any).
    expect(idea?.activity.starts).toBeGreaterThanOrEqual(3);
    // Tests: 1 in-browser + 2 graded checks. Retries: 1 in-browser + 1 check.
    expect(idea?.activity).toMatchObject({ tests: 3, retries: 2, completions: 1 });
    expect(JSON.stringify(ideas)).not.toContain(kid.userId);
  });

  it("the school admin sees start, test, retry and completion by class", async () => {
    const analytics = await getSchoolAnalytics(admin);
    const row = analytics?.aiActivity.find((r) => r.classId === classId);
    expect(row).toMatchObject({ className: "5A", studentCount: 2, tests: 3, retries: 2, completions: 1 });
    expect(row!.starts).toBeGreaterThanOrEqual(3);
    expect(analytics?.aiActivityTotal).toMatchObject({ tests: 3, retries: 2, completions: 1 });
    expect(JSON.stringify(analytics?.aiActivity)).not.toContain(kid.userId);
    // The trend: this week holds everything recorded above.
    const week = analytics!.aiWeekly[analytics!.aiWeekly.length - 1]!;
    expect(analytics!.aiWeekly).toHaveLength(8);
    expect(week).toMatchObject({ tests: 3, retries: 2, completions: 1 });
    // Concepts by class: Fortune Teller teaches uncertainty; one child finished it.
    const concepts = analytics!.aiConceptsByClass.find((r) => r.classId === classId)!;
    expect(concepts.concepts.uncertainty).toMatchObject({ levels: 1, students: 2 });
    // The trend: everything above happened today, so four weeks ago nobody was secure.
    expect(concepts.secureBefore.uncertainty).toBe(0);
    expect(JSON.stringify(analytics?.aiConceptsByClass)).not.toContain(kid.userId);
  });
});

describe("two starts at once", () => {
  it("record one session", async () => {
    await db.learningEvent.deleteMany({ where: { studentUserId: other.userId, type: "LEVEL_SESSION_STARTED" } });
    const results = await Promise.all([1, 2, 3].map(() => recordPlayEventCore(other, levelId, { kind: "start" })));
    expect(results.filter((r) => r.recorded)).toHaveLength(1);
    expect(await db.learningEvent.count({ where: { studentUserId: other.userId, levelId, type: "LEVEL_SESSION_STARTED" } })).toBe(1);
  });
});

describe("return session", () => {
  it("counts children who came back to the AI activities on another day, never who", async () => {
    // Everything on one day first: nobody has come back yet.
    const now = new Date();
    await db.learningEvent.updateMany({ where: { levelId: { in: [levelId, lockedId] } }, data: { createdAt: now } });
    expect((await getSchoolAnalytics(admin))!.aiReturnedTotal).toBe(0);

    // One of the child's sessions three days earlier: a return.
    // A session start: one of the counted types (an unordered pick could land on
    // an event type the measure ignores, which is how CI once read 0).
    const first = await db.learningEvent.findFirstOrThrow({
      where: { studentUserId: kid.userId, levelId, type: "LEVEL_SESSION_STARTED" },
      orderBy: { createdAt: "asc" },
    });
    await db.learningEvent.update({ where: { id: first.id }, data: { createdAt: new Date(now.getTime() - 3 * 86_400_000) } });
    const analytics = await getSchoolAnalytics(admin);
    expect(analytics!.aiReturnedTotal).toBe(1);
    expect(analytics!.aiActivity.find((r) => r.classId === classId)!.returned).toBe(1);
    expect(JSON.stringify(analytics!.aiActivity)).not.toContain(kid.userId);

    // Outside the 30-day window it no longer counts.
    await db.learningEvent.update({ where: { id: first.id }, data: { createdAt: new Date(now.getTime() - 40 * 86_400_000) } });
    expect((await getSchoolAnalytics(admin))!.aiReturnedTotal).toBe(0);
  });
});
