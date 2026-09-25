import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { getClassAiIdeas } from "@/modules/analytics/server/queries";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { answerConceptCheckCore, getExploreLevelContext } from "@/modules/explore/server/checks";
import { getExploreState } from "@/modules/explore/server/queries";
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
 * Explore AI (redesign brief 2026-09-25) against real rows: the hub shows a
 * brand-new child the AI activities in their programme, open from day one;
 * the quick check keeps the FIRST answer and never stores anything typed;
 * the teacher sees understanding apart from completion, for their class only.
 */

let teacherCtx: SessionContext;
let otherTeacherCtx: SessionContext;
let classId: string;
let schoolId: string;
const kids: { id: string; ctx: SessionContext }[] = [];
let sorterId: string;
let bridgeId: string;
let predictId: string;
let codingId: string;

async function slugged(moduleId: string, order: number, slug: string, title: string): Promise<string> {
  const level = await createTestLevel(moduleId, order, { title });
  await db.level.update({ where: { id: level.id }, data: { slug } });
  return level.id;
}

async function finish(studentUserId: string, levelId: string): Promise<void> {
  const done = { status: "COMPLETED" as const, stars: 2, firstCompletedAt: new Date() };
  await db.studentProgress.upsert({
    where: { studentUserId_levelId: { studentUserId, levelId } },
    update: done,
    create: { schoolId, studentUserId, levelId, unlockSource: "EXPLORE", ...done },
  });
}

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Explore Hub");
  schoolId = school.id;
  const teacher = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-t@test.example`,
    displayName: "Hub Teacher",
    role: "TEACHER",
    password: "teach-pass-31",
  });
  const other = await createStaff(SYSTEM_ACTOR, {
    schoolId,
    email: `${school.code}-o@test.example`,
    displayName: "Other Teacher",
    role: "TEACHER",
    password: "teach-pass-32",
  });
  const year = await db.academicYear.create({
    data: { schoolId, name: "2026-2027", startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-06-30T00:00:00Z") },
  });
  const cls = await db.class.create({ data: { schoolId, academicYearId: year.id, name: "3C", grade: 3 } });
  classId = cls.id;
  await db.classMembership.create({ data: { schoolId, classId, userId: teacher.userId, role: "TEACHER" } });

  const program = await createTestProgram({ name: "Hub Program" });
  const coding = await addWorldToProgram(program.id, 1, { name: "Coding World" });
  const ai = await addWorldToProgram(program.id, 2, { name: "AI World" });
  const data = await addWorldToProgram(program.id, 3, { name: "Data World" });
  codingId = (await createTestLevel((await createTestModule(coding.id, 1)).id, 1, { title: "First Hop" })).id;
  const teaching = await createTestModule(ai.id, 1);
  sorterId = await slugged(teaching.id, 1, "berry-sorter", "Teach the Bunny");
  bridgeId = await slugged(teaching.id, 2, "rule-or-examples", "Rule or Examples?");
  const lines = await createTestModule(data.id, 1);
  await createTestLevel(lines.id, 1, { title: "Before the Line" });
  predictId = await slugged(lines.id, 2, "fortune-teller", "Fortune Teller");
  await enableProgramForSchool(schoolId, program.id);

  for (const [i, name] of ["rana", "sami"].entries()) {
    const student = await createStudent(SYSTEM_ACTOR, {
      schoolId,
      schoolCode: school.code,
      username: `${name}hub`,
      displayName: `${name[0]!.toUpperCase()}${name.slice(1)} H.`,
      studentIdentifier: `HUB-${i}`,
      grade: 3,
    });
    await db.classMembership.create({ data: { schoolId, classId, userId: student.userId, role: "STUDENT" } });
    kids.push({ id: student.userId, ctx: createCtx({ userId: student.userId, role: "STUDENT", schoolId }) });
  }
  teacherCtx = createCtx({ userId: teacher.userId, role: "TEACHER", schoolId });
  otherTeacherCtx = createCtx({ userId: other.userId, role: "TEACHER", schoolId });
});

describe("Explore AI hub", () => {
  it("shows a brand-new child the AI activities in their programme, open before any coding", async () => {
    const state = await getExploreState(kids[0]!.ctx);
    // Only the catalog levels this programme has, in catalog order.
    expect(state.cards.map((card) => card.slug)).toEqual(["berry-sorter", "fortune-teller"]);
    expect(state.cards.every((card) => card.state === "UNLOCKED")).toBe(true);
    expect(state.cards[0]).toMatchObject({ levelId: sorterId, concept: "examples", explained: false });
    // The bridge follows Teach the Bunny the normal way.
    expect(state.followUp).toMatchObject({ levelId: bridgeId, state: "LOCKED" });
    expect(state.completed).toBe(0);
    // The coding path is untouched: its first level is open as always.
    const coding = await db.studentProgress.findUnique({
      where: { studentUserId_levelId: { studentUserId: kids[0]!.id, levelId: codingId } },
    });
    expect(coding?.status).toBe("UNLOCKED");
  });

  it("finishing Teach the Bunny opens the rule-versus-learning bridge", async () => {
    await finish(kids[0]!.id, sorterId);
    const state = await getExploreState(kids[0]!.ctx);
    expect(state.followUp?.state).toBe("UNLOCKED");
    expect(state.completed).toBe(1);
  });

  it("the play page knows which levels are Explore AI and which ask a quick check", async () => {
    expect(await getExploreLevelContext(kids[0]!.ctx, sorterId)).toEqual({
      isExplore: true,
      check: { concept: "examples", answeredCorrectly: false },
    });
    expect(await getExploreLevelContext(kids[0]!.ctx, bridgeId)).toMatchObject({ isExplore: true, check: { concept: "rules" } });
    expect(await getExploreLevelContext(kids[0]!.ctx, codingId)).toEqual({ isExplore: false, check: null });
    expect(await getExploreLevelContext(teacherCtx, sorterId)).toEqual({ isExplore: false, check: null });
  });
});

describe("quick check", () => {
  it("is refused until the level is finished, and for levels without one", async () => {
    await expect(answerConceptCheckCore(kids[1]!.ctx, { levelId: sorterId, choice: "b" })).rejects.toThrow();
    await expect(answerConceptCheckCore(kids[0]!.ctx, { levelId: codingId, choice: "a" })).rejects.toThrow();
    expect(await db.conceptCheck.count()).toBe(0);
  });

  it("keeps the first answer, and records when the right one came", async () => {
    expect(await answerConceptCheckCore(kids[0]!.ctx, { levelId: sorterId, choice: "a" })).toEqual({ correct: false });
    expect(await answerConceptCheckCore(kids[0]!.ctx, { levelId: sorterId, choice: "b" })).toEqual({ correct: true });
    // A later wrong tap changes nothing.
    await answerConceptCheckCore(kids[0]!.ctx, { levelId: sorterId, choice: "c" });
    const row = await db.conceptCheck.findUniqueOrThrow({
      where: { studentUserId_levelId: { studentUserId: kids[0]!.id, levelId: sorterId } },
    });
    expect(row).toMatchObject({ firstChoice: "a", firstCorrect: false });
    expect(row.correctAt).not.toBeNull();
    expect(await getExploreLevelContext(kids[0]!.ctx, sorterId)).toMatchObject({ check: { answeredCorrectly: true } });
    const state = await getExploreState(kids[0]!.ctx);
    expect(state.cards[0]).toMatchObject({ explained: true });
  });

  it("stores nothing while a platform admin views as the child", async () => {
    await finish(kids[1]!.id, sorterId);
    const viewing = { ...kids[1]!.ctx, impersonatedBy: "platform-admin" };
    expect(await answerConceptCheckCore(viewing, { levelId: sorterId, choice: "b" })).toEqual({ correct: true });
    expect(await db.conceptCheck.count({ where: { studentUserId: kids[1]!.id } })).toBe(0);
  });
});

describe("teacher: AI ideas", () => {
  it("reports finishing and understanding apart, as class totals", async () => {
    await answerConceptCheckCore(kids[1]!.ctx, { levelId: sorterId, choice: "b" });
    const report = await getClassAiIdeas(teacherCtx, classId);
    expect(report?.students).toBe(2);
    expect(report?.ideas.map((idea) => idea.concept)).toEqual(["examples", "rules", "prediction"]);
    // Both finished Teach the Bunny; one explained it first time, one on a second try.
    expect(report?.ideas[0]).toMatchObject({ levelId: sorterId, finished: 2, answered: 2, firstTry: 1 });
    expect(report?.ideas[2]).toMatchObject({ levelId: predictId, finished: 0, answered: 0 });
    // Totals only: no child ids anywhere in it.
    const serialized = JSON.stringify(report);
    for (const kid of kids) expect(serialized).not.toContain(kid.id);
  });

  it("is closed to a teacher who doesn't teach the class", async () => {
    expect(await getClassAiIdeas(otherTeacherCtx, classId)).toBeNull();
  });
});
