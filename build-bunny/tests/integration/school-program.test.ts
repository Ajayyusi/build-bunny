import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import { computeAdventureState } from "@/modules/learning/server/adventure";
import {
  setSchoolProgram,
  updateLicence,
} from "@/modules/schools/server/platform-management";
import { getSchoolDetail } from "@/modules/schools/server/platform-queries";
import type { SessionContext } from "@/modules/auth/server/session";
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
 * Which curriculum a school gets.
 *
 * The invariant under test is not "a programme is stored" but "EXACTLY one
 * is stored". computeAdventureState resolves a school's programme with
 * `if (enabled.length !== 1) return null`, so two enabled programmes hide
 * the adventure map from every student in the school just as thoroughly as
 * zero — and that failure is silent, which is what makes it worth pinning
 * down here rather than trusting the UI to only ever send sensible input.
 */

let platformCtx: SessionContext;
let schoolAdminCtx: SessionContext;
let schoolId: string;

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Program");
  schoolId = school.id;
  platformCtx = createCtx({ role: "NITAQ_ADMIN", schoolId: null });
  schoolAdminCtx = createCtx({ role: "SCHOOL_ADMIN", schoolId });
});

describe("setSchoolProgram", () => {
  it("attaches a published programme to a school that had none", async () => {
    const program = await createTestProgram({ name: "Core" });
    await setSchoolProgram(platformCtx, schoolId, program.id);

    const rows = await db.schoolProgram.findMany({ where: { schoolId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.programId).toBe(program.id);
  });

  it("REPLACES rather than accumulates, so a school can never hold two", async () => {
    const first = await createTestProgram({ name: "First" });
    const second = await createTestProgram({ name: "Second" });

    await setSchoolProgram(platformCtx, schoolId, first.id);
    await setSchoolProgram(platformCtx, schoolId, second.id);

    const rows = await db.schoolProgram.findMany({ where: { schoolId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.programId).toBe(second.id);
  });

  it("repairs a school that already had two enabled programmes", async () => {
    // The pre-existing broken state this screen has to be able to fix.
    await db.schoolProgram.deleteMany({ where: { schoolId } });
    const a = await createTestProgram({ name: "A" });
    const b = await createTestProgram({ name: "B" });
    await enableProgramForSchool(schoolId, a.id);
    await enableProgramForSchool(schoolId, b.id);
    expect(await db.schoolProgram.count({ where: { schoolId } })).toBe(2);

    await setSchoolProgram(platformCtx, schoolId, a.id);

    const rows = await db.schoolProgram.findMany({ where: { schoolId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.programId).toBe(a.id);
  });

  it("clears the programme when passed null", async () => {
    const program = await createTestProgram();
    await setSchoolProgram(platformCtx, schoolId, program.id);
    await setSchoolProgram(platformCtx, schoolId, null);

    expect(await db.schoolProgram.count({ where: { schoolId } })).toBe(0);
  });

  it("refuses a DRAFT programme — the map only renders published content", async () => {
    const draft = await createTestProgram({ status: "DRAFT", name: "Draft" });
    await expect(setSchoolProgram(platformCtx, schoolId, draft.id)).rejects.toThrow();
  });

  it("refuses an unknown programme id", async () => {
    await expect(setSchoolProgram(platformCtx, schoolId, "does-not-exist")).rejects.toThrow();
  });

  it("refuses an unknown school id", async () => {
    const program = await createTestProgram();
    await expect(setSchoolProgram(platformCtx, "no-such-school", program.id)).rejects.toThrow();
  });

  it("leaves the previous programme in place when the new one is rejected", async () => {
    const good = await createTestProgram({ name: "Good" });
    const draft = await createTestProgram({ status: "DRAFT", name: "Bad" });
    await setSchoolProgram(platformCtx, schoolId, good.id);

    await expect(setSchoolProgram(platformCtx, schoolId, draft.id)).rejects.toThrow();

    // Validation runs before the delete, so a rejected change must not have
    // stripped the curriculum the school was already using.
    const rows = await db.schoolProgram.findMany({ where: { schoolId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.programId).toBe(good.id);
  });

  it("is platform-only — a school admin cannot set their own curriculum", async () => {
    const program = await createTestProgram();
    await expect(setSchoolProgram(schoolAdminCtx, schoolId, program.id)).rejects.toThrow();
  });
});

/**
 * The end-to-end shape of the real failure: a school gets its students first
 * and its curriculum second. Both halves had to be fixed for this to work —
 * a programme the console can set, and unlocks that materialize when the
 * student next opens the map instead of only after a submission they were
 * locked out of making.
 */
describe("a school that gains curriculum after its students exist", () => {
  it("opens the first level for a student who was created before the programme", async () => {
    // No wipe: this builds its own school and student, and the suite's other
    // blocks are still using theirs.
    const school = await createTestSchool("Late");
    const student = await createStudent(SYSTEM_ACTOR, {
      schoolId: school.id,
      schoolCode: school.code,
      username: "late",
      displayName: "Late Starter",
      studentIdentifier: "LATE-001",
      grade: 4,
    });
    const studentCtx = createCtx({
      userId: student.userId,
      role: "STUDENT",
      schoolId: school.id,
    });
    const platform = createCtx({ role: "NITAQ_ADMIN", schoolId: null });

    // Before curriculum: no programme, so no map at all.
    const before = await computeAdventureState(studentCtx);
    expect(before.program).toBeNull();
    expect(before.worlds).toEqual([]);

    const program = await createTestProgram({ name: "Late Curriculum" });
    const world = await addWorldToProgram(program.id, 1, { name: "First World" });
    const mod = await createTestModule(world.id, 1);
    const first = await createTestLevel(mod.id, 1, { title: "First Level" });
    await createTestLevel(mod.id, 2, { title: "Second Level" });

    await setSchoolProgram(platform, school.id, program.id);

    // The student has still submitted nothing and has no progress rows —
    // opening the map is what gives them their starting level.
    expect(await db.studentProgress.count({ where: { studentUserId: student.userId } })).toBe(0);

    const after = await computeAdventureState(studentCtx);
    expect(after.program?.id).toBe(program.id);
    expect(after.currentLevelId).toBe(first.id);

    const levels = after.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels));
    expect(levels.find((l) => l.id === first.id)?.state).toBe("UNLOCKED");
  });
});

describe("getSchoolDetail programme reporting", () => {
  it("reports the single enabled programme", async () => {
    await db.schoolProgram.deleteMany({ where: { schoolId } });
    const program = await createTestProgram({ name: "Reported" });
    await enableProgramForSchool(schoolId, program.id);

    const detail = await getSchoolDetail(platformCtx, schoolId);
    expect(detail?.program?.id).toBe(program.id);
    expect(detail?.programAmbiguous).toBe(false);
  });

  it("reports null + ambiguous when a school holds more than one", async () => {
    await db.schoolProgram.deleteMany({ where: { schoolId } });
    const a = await createTestProgram({ name: "One" });
    const b = await createTestProgram({ name: "Two" });
    await enableProgramForSchool(schoolId, a.id);
    await enableProgramForSchool(schoolId, b.id);

    const detail = await getSchoolDetail(platformCtx, schoolId);
    // Deliberately null, not "the first one": the console must agree with
    // what the student actually sees, which is nothing.
    expect(detail?.program).toBeNull();
    expect(detail?.programAmbiguous).toBe(true);
  });

  it("reports null + unambiguous when a school has none", async () => {
    await db.schoolProgram.deleteMany({ where: { schoolId } });

    const detail = await getSchoolDetail(platformCtx, schoolId);
    expect(detail?.program).toBeNull();
    expect(detail?.programAmbiguous).toBe(false);
  });
});

/**
 * Licence editing. These rules decide whether a school keeps access, so the
 * ones that could quietly take it away are pinned here rather than left to
 * the form.
 */
describe("updateLicence", () => {
  async function freshSchool(seats: number) {
    const school = await createTestSchool("Licence", { seats });
    const licence = await db.licence.findFirstOrThrow({ where: { schoolId: school.id } });
    return { school, licence };
  }

  it("writes graceDays, which had no writer at all before", async () => {
    const { licence } = await freshSchool(50);
    expect(licence.graceDays).toBe(30); // the schema default everyone was stuck on

    await updateLicence(platformCtx, licence.id, {
      seats: licence.seats,
      startsAt: licence.startsAt,
      expiresAt: licence.expiresAt,
      graceDays: 60,
      status: "ACTIVE",
      notes: null,
    });

    const after = await db.licence.findUniqueOrThrow({ where: { id: licence.id } });
    expect(after.graceDays).toBe(60);
  });

  it("refuses seats below the number of active students", async () => {
    const { school, licence } = await freshSchool(50);
    await createStudent(SYSTEM_ACTOR, {
      schoolId: school.id,
      schoolCode: school.code,
      username: "seatholder",
      displayName: "Seat Holder",
      studentIdentifier: "SEAT-1",
      grade: 4,
    });

    // Cutting seats below the roster would not remove anyone — it would just
    // put the school permanently over its limit with no way back.
    await expect(
      updateLicence(platformCtx, licence.id, {
        seats: 0, // below the single enrolled student
        startsAt: licence.startsAt,
        expiresAt: licence.expiresAt,
        graceDays: 30,
        status: "ACTIVE",
        notes: null,
      }),
    ).rejects.toThrow();
  });

  it("refuses a licence that expires before it starts", async () => {
    const { licence } = await freshSchool(10);
    await expect(
      updateLicence(platformCtx, licence.id, {
        seats: 10,
        startsAt: new Date("2027-01-01"),
        expiresAt: new Date("2026-01-01"),
        graceDays: 30,
        status: "ACTIVE",
        notes: null,
      }),
    ).rejects.toThrow();
  });

  it("suspending ends every open session in the school", async () => {
    const { school, licence } = await freshSchool(10);
    const student = await createStudent(SYSTEM_ACTOR, {
      schoolId: school.id,
      schoolCode: school.code,
      username: "sessionholder",
      displayName: "Session Holder",
      studentIdentifier: "SESS-1",
      grade: 4,
    });
    await db.session.create({
      data: {
        userId: student.userId,
        token: `tok-${student.userId}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    expect(await db.session.count({ where: { userId: student.userId } })).toBe(1);

    await updateLicence(platformCtx, licence.id, {
      seats: 10,
      startsAt: licence.startsAt,
      expiresAt: licence.expiresAt,
      graceDays: 30,
      status: "SUSPENDED",
      notes: null,
    });

    expect(await db.session.count({ where: { userId: student.userId } })).toBe(0);
  });

  it("is platform-only", async () => {
    const { school, licence } = await freshSchool(10);
    const schoolAdmin = createCtx({ role: "SCHOOL_ADMIN", schoolId: school.id });
    await expect(
      updateLicence(schoolAdmin, licence.id, {
        seats: 999,
        startsAt: licence.startsAt,
        expiresAt: licence.expiresAt,
        graceDays: 30,
        status: "ACTIVE",
        notes: null,
      }),
    ).rejects.toThrow();
  });
});
