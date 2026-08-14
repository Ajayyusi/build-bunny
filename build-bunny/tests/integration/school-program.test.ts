import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { setSchoolProgram } from "@/modules/schools/server/platform-management";
import { getSchoolDetail } from "@/modules/schools/server/platform-queries";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  createCtx,
  createTestProgram,
  createTestSchool,
  enableProgramForSchool,
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
