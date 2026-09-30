import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { NotFoundError } from "@/modules/auth/server/guard";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { launchExploreActivityCore, setExploreActivityOpenCore, stopExploreLaunchCore } from "@/modules/explore/server/launch";
import { getClassExploreSettings, getExploreState } from "@/modules/explore/server/queries";
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
 * Activity launch control against real rows: only a class's own teacher
 * changes it; the child's Explore AI page follows it (hidden only when every
 * class hides it, the latest launch pinned); every change is audited, and
 * nothing touches progress.
 */

let schoolId: string;
let teacher: SessionContext;
let otherTeacher: SessionContext;
let admin: SessionContext;
let foreignTeacher: SessionContext;
let kid: SessionContext;
let twoClassKid: SessionContext;
let classA: string;
let classB: string;

async function slugged(moduleId: string, order: number, slug: string, title: string): Promise<string> {
  const level = await createTestLevel(moduleId, order, { title });
  await db.level.update({ where: { id: level.id }, data: { slug } });
  return level.id;
}

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Launch");
  const elsewhere = await createTestSchool("Elsewhere");
  schoolId = school.id;
  const staff = async (sId: string, code: string, role: "TEACHER" | "SCHOOL_ADMIN", name: string) =>
    createStaff(SYSTEM_ACTOR, { schoolId: sId, email: `${code}-${name}@test.example`, displayName: name, role, password: "launch-pass-71" });
  const t = await staff(schoolId, school.code, "TEACHER", "t");
  const t2 = await staff(schoolId, school.code, "TEACHER", "t2");
  const a = await staff(schoolId, school.code, "SCHOOL_ADMIN", "a");
  const ft = await staff(elsewhere.id, elsewhere.code, "TEACHER", "ft");
  const year = await db.academicYear.create({
    data: { schoolId, name: "2026-2027", startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-06-30T00:00:00Z") },
  });
  classA = (await db.class.create({ data: { schoolId, academicYearId: year.id, name: "3A", grade: 3 } })).id;
  classB = (await db.class.create({ data: { schoolId, academicYearId: year.id, name: "3B", grade: 3 } })).id;
  const student = async (name: string, i: number) =>
    createStudent(SYSTEM_ACTOR, { schoolId, schoolCode: school.code, username: name, displayName: name, studentIdentifier: `L-${i}`, grade: 3 });
  const s1 = await student("launchkid", 1);
  const s2 = await student("twoclasskid", 2);
  await db.classMembership.createMany({
    data: [
      { schoolId, classId: classA, userId: t.userId, role: "TEACHER" },
      { schoolId, classId: classB, userId: t2.userId, role: "TEACHER" },
      { schoolId, classId: classA, userId: s1.userId, role: "STUDENT" },
      { schoolId, classId: classA, userId: s2.userId, role: "STUDENT" },
      { schoolId, classId: classB, userId: s2.userId, role: "STUDENT" },
    ],
  });

  const program = await createTestProgram({ name: "Launch Program" });
  const ai = await addWorldToProgram(program.id, 1, { name: "AI World" });
  const mod = await createTestModule(ai.id, 1);
  await slugged(mod.id, 1, "train-a-sorter", "Train a Sorter");
  await slugged(mod.id, 2, "fortune-teller", "Fortune Teller");
  await slugged(mod.id, 3, "who-decides", "Who Decides?");
  await enableProgramForSchool(schoolId, program.id);

  teacher = createCtx({ userId: t.userId, role: "TEACHER", schoolId });
  otherTeacher = createCtx({ userId: t2.userId, role: "TEACHER", schoolId });
  admin = createCtx({ userId: a.userId, role: "SCHOOL_ADMIN", schoolId });
  foreignTeacher = createCtx({ userId: ft.userId, role: "TEACHER", schoolId: elsewhere.id });
  kid = createCtx({ userId: s1.userId, role: "STUDENT", schoolId });
  twoClassKid = createCtx({ userId: s2.userId, role: "STUDENT", schoolId });
});

const slugsOf = async (ctx: SessionContext) => (await getExploreState(ctx)).cards.map((card) => card.slug);

describe("activity launch control", () => {
  it("starts with everything open and nothing launched", async () => {
    expect(await slugsOf(kid)).toEqual(["train-a-sorter", "fortune-teller", "who-decides"]);
    expect((await getExploreState(kid)).launched).toBeNull();
    const view = await getClassExploreSettings(teacher, classA);
    expect(view?.canManage).toBe(true);
    expect(view?.activities.every((a) => a.open && !a.launched)).toBe(true);
  });

  it("the class's teacher switches one off, and it leaves the child's page", async () => {
    await setExploreActivityOpenCore(teacher, { classId: classA, slug: "fortune-teller", open: false });
    expect(await slugsOf(kid)).toEqual(["train-a-sorter", "who-decides"]);
    expect((await getClassExploreSettings(teacher, classA))?.activities.find((a) => a.slug === "fortune-teller")?.open).toBe(false);
  });

  it("a child in two classes keeps it while their other class has it on", async () => {
    expect(await slugsOf(twoClassKid)).toContain("fortune-teller");
    await setExploreActivityOpenCore(otherTeacher, { classId: classB, slug: "fortune-teller", open: false });
    expect(await slugsOf(twoClassKid)).not.toContain("fortune-teller");
    await setExploreActivityOpenCore(otherTeacher, { classId: classB, slug: "fortune-teller", open: true });
  });

  it("launching pins it for the class, opens it, and replaces an earlier launch", async () => {
    await launchExploreActivityCore(teacher, { classId: classA, slug: "who-decides" });
    expect((await getExploreState(kid)).launched?.slug).toBe("who-decides");
    await launchExploreActivityCore(teacher, { classId: classA, slug: "fortune-teller" });
    const state = await getExploreState(kid);
    expect(state.launched?.slug).toBe("fortune-teller");
    expect(state.cards.map((c) => c.slug)).toContain("fortune-teller");
    expect(await db.classExploreActivity.count({ where: { classId: classA, launchedAt: { not: null } } })).toBe(1);
  });

  it("switching the launched activity off stops the launch", async () => {
    await setExploreActivityOpenCore(teacher, { classId: classA, slug: "fortune-teller", open: false });
    expect((await getExploreState(kid)).launched).toBeNull();
    await setExploreActivityOpenCore(teacher, { classId: classA, slug: "fortune-teller", open: true });
  });

  it("stop clears it", async () => {
    await launchExploreActivityCore(teacher, { classId: classA, slug: "train-a-sorter" });
    await stopExploreLaunchCore(teacher, { classId: classA });
    expect((await getExploreState(kid)).launched).toBeNull();
  });

  it("nobody else can change a class: another teacher, the school admin, another school, the child", async () => {
    for (const ctx of [otherTeacher, admin, foreignTeacher, kid]) {
      await expect(launchExploreActivityCore(ctx, { classId: classA, slug: "train-a-sorter" })).rejects.toThrow(NotFoundError);
      await expect(setExploreActivityOpenCore(ctx, { classId: classA, slug: "train-a-sorter", open: false })).rejects.toThrow(NotFoundError);
      await expect(stopExploreLaunchCore(ctx, { classId: classA })).rejects.toThrow(NotFoundError);
    }
    // Only Explore AI activities, never an arbitrary level.
    await expect(launchExploreActivityCore(teacher, { classId: classA, slug: "first-hop" })).rejects.toThrow(NotFoundError);
  });

  it("the school admin sees the settings but can't change them; others see nothing", async () => {
    expect((await getClassExploreSettings(admin, classA))?.canManage).toBe(false);
    expect(await getClassExploreSettings(otherTeacher, classA)).toBeNull();
    expect(await getClassExploreSettings(foreignTeacher, classA)).toBeNull();
    expect(await getClassExploreSettings(kid, classA)).toBeNull();
  });

  it("every change is audited, and progress is never touched", async () => {
    const actions = (await db.auditLog.findMany({ where: { targetId: classA }, select: { action: true } })).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "class.explore_activity_hidden",
        "class.explore_activity_opened",
        "class.explore_activity_launched",
        "class.explore_launch_stopped",
      ]),
    );
    const progress = () => db.studentProgress.findMany({ where: { schoolId }, orderBy: { id: "asc" } });
    const before = await progress();
    await setExploreActivityOpenCore(teacher, { classId: classA, slug: "who-decides", open: false });
    await launchExploreActivityCore(teacher, { classId: classA, slug: "train-a-sorter" });
    await stopExploreLaunchCore(teacher, { classId: classA });
    expect(await progress()).toEqual(before);
  });
});
