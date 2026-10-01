import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { getStudentDetail } from "@/modules/analytics/server/queries";
import { NotFoundError } from "@/modules/auth/server/guard";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { getExploreLevelContext } from "@/modules/explore/server/checks";
import { saveExplanationCore, setConceptObservedCore } from "@/modules/explore/server/explanations";
import {
  addWorldToProgram,
  createCtx,
  createTestLevel,
  createTestModule,
  createTestProgram,
  createTestSchool,
  SYSTEM_ACTOR,
  wipeDatabase,
} from "../helpers/fixtures";

/**
 * "Say it your way" and the teacher's "heard it explained aloud" against
 * real rows: phrase ids only, for finished levels, in scope.
 */

let kid: SessionContext;
let teacher: SessionContext;
let otherTeacher: SessionContext;
let levelId: string;
let plainId: string;
const sound = ["examples.what2", "examples.why1", "examples.next3"];

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Explain");
  const t = await createStaff(SYSTEM_ACTOR, { schoolId: school.id, email: `${school.code}-t@test.example`, displayName: "T", role: "TEACHER", password: "explain-pass-61" });
  const t2 = await createStaff(SYSTEM_ACTOR, { schoolId: school.id, email: `${school.code}-t2@test.example`, displayName: "T2", role: "TEACHER", password: "explain-pass-61" });
  const s = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "explainkid",
    displayName: "Explain Kid",
    studentIdentifier: "EX-1",
    grade: 4,
  });
  const year = await db.academicYear.create({
    data: { schoolId: school.id, name: "2026-2027", startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-06-30T00:00:00Z") },
  });
  const cls = await db.class.create({ data: { schoolId: school.id, academicYearId: year.id, name: "4A", grade: 4 } });
  await db.classMembership.createMany({
    data: [
      { schoolId: school.id, classId: cls.id, userId: t.userId, role: "TEACHER" },
      { schoolId: school.id, classId: cls.id, userId: s.userId, role: "STUDENT" },
    ],
  });
  const program = await createTestProgram({ name: "Explain" });
  const world = await addWorldToProgram(program.id, 1, { name: "AI" });
  const mod = await createTestModule(world.id, 1);
  const level = await createTestLevel(mod.id, 1, { title: "Train a Sorter" });
  await db.level.update({ where: { id: level.id }, data: { slug: "train-a-sorter" } });
  levelId = level.id;
  plainId = (await createTestLevel(mod.id, 2)).id;
  kid = createCtx({ userId: s.userId, role: "STUDENT", schoolId: school.id });
  teacher = createCtx({ userId: t.userId, role: "TEACHER", schoolId: school.id });
  otherTeacher = createCtx({ userId: t2.userId, role: "TEACHER", schoolId: school.id });
});

describe("the child's sentence", () => {
  it("is refused before the level is finished, and for levels without a quick check", async () => {
    await expect(saveExplanationCore(kid, { levelId, parts: sound })).rejects.toThrow(NotFoundError);
    await expect(saveExplanationCore(kid, { levelId: plainId, parts: sound })).rejects.toThrow(NotFoundError);
  });

  it("saves phrase ids for a finished level, replacing the one before", async () => {
    await db.studentProgress.create({
      data: { schoolId: kid.schoolId!, studentUserId: kid.userId, levelId, status: "COMPLETED", stars: 2 },
    });
    await expect(saveExplanationCore(kid, { levelId, parts: ["rules.what1", "examples.why1", "examples.next3"] })).rejects.toThrow(NotFoundError);
    expect(await saveExplanationCore(kid, { levelId, parts: ["examples.what1", "examples.why1", "examples.next1"] })).toEqual({ saved: true });
    await saveExplanationCore(kid, { levelId, parts: sound });
    const rows = await db.explanationSentence.findMany({ where: { studentUserId: kid.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ parts: sound, soundParts: 3 });
    // Viewing as the child stores nothing new.
    await saveExplanationCore({ ...kid, impersonatedBy: "platform-admin" }, { levelId, parts: ["examples.what1", "examples.why2", "examples.next1"] });
    expect((await db.explanationSentence.findFirstOrThrow({ where: { studentUserId: kid.userId } })).parts).toEqual(sound);
  });
});

describe("the teacher's view and tick", () => {
  it("shows the sentence, and ticks 'heard it explained aloud' for their own pupils only", async () => {
    const detail = await getStudentDetail(teacher, kid.userId);
    expect(detail?.explanations).toEqual([expect.objectContaining({ levelId, concept: "examples", parts: sound, soundParts: 3 })]);
    await setConceptObservedCore(teacher, { studentUserId: kid.userId, concept: "exampleQuality", observed: true });
    expect((await getStudentDetail(teacher, kid.userId))?.observedConcepts).toEqual(["exampleQuality"]);
    await expect(
      setConceptObservedCore(otherTeacher, { studentUserId: kid.userId, concept: "bias", observed: true }),
    ).rejects.toThrow(NotFoundError);
    await setConceptObservedCore(teacher, { studentUserId: kid.userId, concept: "exampleQuality", observed: false });
    expect((await getStudentDetail(teacher, kid.userId))?.observedConcepts).toEqual([]);
    expect(await db.auditLog.count({ where: { action: "student.concept_observed", targetId: kid.userId } })).toBe(2);
  });
});

describe("every AI lesson, not just the ones with a quick check", () => {
  it("offers and saves a sentence on Keep Some Back, about fair testing", async () => {
    const mod = await db.level.findUniqueOrThrow({ where: { id: levelId }, select: { moduleId: true } });
    const keep = await createTestLevel(mod.moduleId, 3, { title: "Keep Some Back" });
    await db.level.update({ where: { id: keep.id }, data: { slug: "keep-some-back" } });
    expect(await getExploreLevelContext(kid, keep.id)).toMatchObject({ check: null, explain: "testing" });

    const testing = ["testing.what2", "testing.why1", "testing.next3"];
    await expect(saveExplanationCore(kid, { levelId: keep.id, parts: testing })).rejects.toThrow(NotFoundError);
    await db.studentProgress.create({
      data: { schoolId: kid.schoolId!, studentUserId: kid.userId, levelId: keep.id, status: "COMPLETED", stars: 3 },
    });
    // The other idea's phrases don't fit this lesson.
    await expect(saveExplanationCore(kid, { levelId: keep.id, parts: sound })).rejects.toThrow(NotFoundError);
    expect(await saveExplanationCore(kid, { levelId: keep.id, parts: testing })).toEqual({ saved: true });
    const detail = await getStudentDetail(teacher, kid.userId);
    expect(detail?.explanations).toContainEqual(expect.objectContaining({ levelId: keep.id, concept: "testing", parts: testing, soundParts: 3 }));
  });
});

describe("the concept trend dates a sentence by when it was first saved", () => {
  it("re-saving an old sentence doesn't move it into the last four weeks", async () => {
    const { loadConceptInput } = await import("@/modules/analytics/server/ai-concepts-load");
    const old = new Date(Date.now() - 40 * 86_400_000);
    await db.explanationSentence.updateMany({ where: { studentUserId: kid.userId, levelId }, data: { createdAt: old } });
    await saveExplanationCore(kid, { levelId, parts: sound });
    const input = await loadConceptInput(kid.schoolId!, [kid.userId], [{ id: levelId, slug: "train-a-sorter" }]);
    const row = input.soundSentences?.find((r) => r.levelId === levelId);
    expect(row?.at?.getTime()).toBe(old.getTime());
  });
});
