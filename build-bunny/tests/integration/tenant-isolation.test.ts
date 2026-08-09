import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  getPlatformOverview,
  listSchools,
} from "@/modules/schools/server/platform-queries";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import type { AdventureState } from "@/modules/learning/server/adventure";
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
 * Plan §0.1-11: the two-school isolation rig. Every module's queries.ts must
 * export a `tenantScopedQueries` registry; this suite globs ALL of them so a
 * new module's queries are automatically pulled under test. A registered
 * query with no explicit assertion case below fails (todo-style) — adding a
 * query forces a test update, silently passing is impossible.
 */

type TenantQuery = (ctx: SessionContext, arg?: unknown) => Promise<unknown>;

const queryModules = import.meta.glob<Record<string, unknown>>(
  "../../src/modules/*/server/queries.ts",
  { eager: true },
);

interface RegistryEntry {
  modulePath: string;
  name: string;
  query: TenantQuery;
}

const registryEntries: RegistryEntry[] = [];
for (const [modulePath, mod] of Object.entries(queryModules)) {
  const registry = mod["tenantScopedQueries"];
  if (!registry || typeof registry !== "object") continue; // completeness suite reports it
  for (const [name, fn] of Object.entries(registry)) {
    if (typeof fn !== "function") continue;
    registryEntries.push({ modulePath, name, query: fn as TenantQuery });
  }
}

interface SchoolFixture {
  school: { id: string; slug: string; code: string };
  adminId: string;
  teacherId: string;
  yearId: string;
  classId: string;
  studentIds: [string, string];
}

async function seedSchool(prefix: string): Promise<SchoolFixture> {
  const school = await createTestSchool(prefix);
  const admin = await createStaff(SYSTEM_ACTOR, {
    schoolId: school.id,
    email: `${school.code}-admin@test.example`,
    displayName: `${prefix} Admin`,
    role: "SCHOOL_ADMIN",
    password: "admin-pass-11",
  });
  const teacher = await createStaff(SYSTEM_ACTOR, {
    schoolId: school.id,
    email: `${school.code}-teacher@test.example`,
    displayName: `${prefix} Teacher`,
    role: "TEACHER",
    password: "teach-pass-11",
  });
  const year = await db.academicYear.create({
    data: {
      schoolId: school.id,
      name: "2026-2027",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2027-06-30T00:00:00Z"),
    },
  });
  const klass = await db.class.create({
    data: {
      schoolId: school.id,
      academicYearId: year.id,
      name: "Grade 3A",
      grade: 3,
    },
  });
  await db.classMembership.create({
    data: {
      schoolId: school.id,
      classId: klass.id,
      userId: teacher.userId,
      role: "TEACHER",
    },
  });
  // Same usernames in both schools on purpose: the namespace ({code}__{name})
  // is what keeps them distinct — a silent collision would fail seeding here.
  const studentOne = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "star",
    displayName: `${prefix} Student One`,
    studentIdentifier: `${prefix}-001`,
    grade: 3,
  });
  const studentTwo = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "moon",
    displayName: `${prefix} Student Two`,
    studentIdentifier: `${prefix}-002`,
    grade: 3,
  });
  for (const studentId of [studentOne.userId, studentTwo.userId]) {
    await db.classMembership.create({
      data: {
        schoolId: school.id,
        classId: klass.id,
        userId: studentId,
        role: "STUDENT",
      },
    });
  }
  await audit({
    action: AUDIT.classes.created,
    actorUserId: admin.userId,
    actorRole: "SCHOOL_ADMIN",
    schoolId: school.id,
    targetType: "class",
    targetId: klass.id,
  });
  return {
    school: { id: school.id, slug: school.slug, code: school.code },
    adminId: admin.userId,
    teacherId: teacher.userId,
    yearId: year.id,
    classId: klass.id,
    studentIds: [studentOne.userId, studentTwo.userId],
  };
}

let A: SchoolFixture;
let B: SchoolFixture;
let ctxA: SessionContext; // SCHOOL_ADMIN of school A — the attacker's viewpoint
let teacherCtxA: SessionContext;
let studentCtxA: SessionContext;
let studentCtxB: SessionContext;
let nitaqCtx: SessionContext;

// M2 curriculum fixture: content is platform-GLOBAL — the isolation property
// for learning queries is that progress/stars come only from the calling
// student's own rows, never from another school's student on the same levels.
let programAId: string;
let levelOneId: string;
let levelTwoId: string;

beforeAll(async () => {
  await wipeDatabase();
  A = await seedSchool("Alpha");
  B = await seedSchool("Beta");

  // Published program with one world/module/2 levels, enabled for school A.
  const programA = await createTestProgram({ name: "Foundations A" });
  programAId = programA.id;
  const world = await addWorldToProgram(programA.id, 1);
  const mod = await createTestModule(world.id, 1);
  const levelOne = await createTestLevel(mod.id, 1, { title: "First Hop" });
  const levelTwo = await createTestLevel(mod.id, 2, { title: "Second Hop" });
  levelOneId = levelOne.id;
  levelTwoId = levelTwo.id;
  await enableProgramForSchool(A.school.id, programA.id);

  // School B runs a DIFFERENT program...
  const programB = await createTestProgram({ name: "Foundations B" });
  await addWorldToProgram(programB.id, 1);
  await enableProgramForSchool(B.school.id, programB.id);

  // ...but its student holds full-star COMPLETED rows on program A's global
  // levels. Those rows must never surface in school A's adventure state.
  for (const levelId of [levelOneId, levelTwoId]) {
    await db.studentProgress.create({
      data: {
        schoolId: B.school.id,
        studentUserId: B.studentIds[0],
        levelId,
        status: "COMPLETED",
        stars: 3,
        unlockSource: "SEED",
      },
    });
  }

  await recomputeUnlocks(A.studentIds[0]);
  ctxA = createCtx({
    userId: A.adminId,
    role: "SCHOOL_ADMIN",
    schoolId: A.school.id,
  });
  teacherCtxA = createCtx({
    userId: A.teacherId,
    role: "TEACHER",
    schoolId: A.school.id,
  });
  studentCtxA = createCtx({
    userId: A.studentIds[0],
    role: "STUDENT",
    schoolId: A.school.id,
  });
  studentCtxB = createCtx({
    userId: B.studentIds[0],
    role: "STUDENT",
    schoolId: B.school.id,
  });
  nitaqCtx = createCtx({
    userId: "platform-admin",
    role: "NITAQ_ADMIN",
    schoolId: null,
  });
});

/** Every identifier that must NEVER appear in a school-A-scoped result. */
function foreignIdentifiers(): string[] {
  return [
    B.school.id,
    B.school.slug,
    B.school.code,
    B.adminId,
    B.teacherId,
    B.yearId,
    B.classId,
    ...B.studentIds,
  ];
}

/** Deep-scan a query result's JSON for any school B identifier. */
function expectNoForeignIds(value: unknown, queryName: string): void {
  const json = JSON.stringify(value) ?? "";
  for (const id of foreignIdentifiers()) {
    expect(
      json.includes(id),
      `query "${queryName}" leaked school B identifier "${id}" — fix the query's tenant scoping and add explicit isolation assertions for it`,
    ).toBe(false);
  }
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  expect(Array.isArray(value)).toBe(true);
  return value as Array<Record<string, unknown>>;
}

async function assertQueryIsolated(entry: RegistryEntry): Promise<void> {
  const { name, query } = entry;
  switch (name) {
    case "getSchoolSummary": {
      const summary = (await query(ctxA)) as { id: string } | null;
      expect(summary).not.toBeNull();
      expect(summary?.id).toBe(A.school.id);
      expectNoForeignIds(summary, name);
      break;
    }
    case "listTeachers": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBe(1);
      for (const row of rows) expect(row["id"]).toBe(A.teacherId);
      expectNoForeignIds(rows, name);
      break;
    }
    case "listStudents": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBe(2);
      for (const row of rows) {
        expect(A.studentIds).toContain(row["id"]);
        expect(B.studentIds).not.toContain(row["id"]);
      }
      expectNoForeignIds(rows, name);
      break;
    }
    case "getStudentDetail": {
      // A foreign student id must resolve to nothing, not an error the UI
      // could distinguish from "does not exist".
      expect(await query(ctxA, B.studentIds[0])).toBeNull();
      const own = (await query(ctxA, A.studentIds[0])) as { id: string } | null;
      expect(own?.id).toBe(A.studentIds[0]);
      expectNoForeignIds(own, name);
      break;
    }
    case "listClasses": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBe(1);
      for (const row of rows) expect(row["id"]).toBe(A.classId);
      expectNoForeignIds(rows, name);
      break;
    }
    case "getClassDetail": {
      expect(await query(ctxA, B.classId)).toBeNull();
      const own = (await query(ctxA, A.classId)) as { id: string } | null;
      expect(own?.id).toBe(A.classId);
      expectNoForeignIds(own, name);
      break;
    }
    case "listMyClasses": {
      const rows = asRows(await query(teacherCtxA));
      expect(rows.length).toBe(1);
      expect(rows[0]?.["id"]).toBe(A.classId);
      expectNoForeignIds(rows, name);
      break;
    }
    case "listSchoolAuditLogs": {
      const rows = asRows(await query(ctxA));
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) expect(row["schoolId"]).toBe(A.school.id);
      expectNoForeignIds(rows, name);
      break;
    }
    case "getMyStudentSnapshot": {
      const own = await query(studentCtxA);
      expect(own).not.toBeNull();
      expectNoForeignIds(own, name);
      // A ctx claiming school A but carrying school B's user must get nothing.
      const mismatched = createCtx({
        userId: B.studentIds[0],
        role: "STUDENT",
        schoolId: A.school.id,
      });
      expect(await query(mismatched)).toBeNull();
      break;
    }
    case "computeAdventureState": {
      const state = (await query(studentCtxA)) as AdventureState;
      expect(state.program?.id).toBe(programAId);
      const world = state.worlds[0];
      expect(world).toBeDefined();
      const levels = world!.modules[0]!.levels;
      const one = levels.find((l) => l.id === levelOneId);
      const two = levels.find((l) => l.id === levelTwoId);
      // Student A's own unlock state: level 1 opened by recomputeUnlocks,
      // level 2 still locked...
      expect(one?.state).toBe("UNLOCKED");
      expect(two?.state).toBe("LOCKED");
      expect(state.currentLevelId).toBe(levelOneId);
      // ...and NONE of school-B student's full-star COMPLETED rows on these
      // same global levels bleed into A's view.
      expect(one?.stars).toBe(0);
      expect(two?.stars).toBe(0);
      expect(world!.starsEarned).toBe(0);
      expect(world!.completedLevels).toBe(0);
      expectNoForeignIds(state, name);
      break;
    }
    case "getLevelIntro": {
      const intro = (await query(studentCtxA, levelOneId)) as Record<
        string,
        unknown
      > | null;
      expect(intro).not.toBeNull();
      // Progress comes only from the calling student's rows — school B's
      // 3-star completion of the same global level must not appear.
      expect(intro?.["state"]).toBe("UNLOCKED");
      expect(intro?.["stars"]).toBe(0);
      // Answer-bearing content never reaches the student surface.
      expect(intro && "payload" in intro).toBe(false);
      expect(intro && "hints" in intro).toBe(false);
      expect(JSON.stringify(intro)).not.toContain("SECRET");
      expectNoForeignIds(intro, name);
      // A school-B student is on a different program: the level is foreign
      // content for them and resolves to nothing (not an error).
      expect(await query(studentCtxB, levelOneId)).toBeNull();
      break;
    }
    // ── Curriculum content queries: platform-GLOBAL, not tenant-scoped.
    // The isolation property is access control: browse queries must reject
    // any school-scoped session outright (requirePlatform), and the
    // published readers must never surface answer-bearing content.
    case "listCurriculumPrograms":
    case "listCurriculumWorlds": {
      await expect(query(ctxA)).rejects.toThrow();
      await expect(query(teacherCtxA)).rejects.toThrow();
      await expect(query(studentCtxA)).rejects.toThrow();
      const rows = await query(nitaqCtx);
      expect(Array.isArray(rows)).toBe(true);
      break;
    }
    case "getCurriculumLevelDetail": {
      await expect(query(ctxA, levelOneId)).rejects.toThrow();
      await expect(query(studentCtxA, levelOneId)).rejects.toThrow();
      expect(await query(nitaqCtx, "no-such-level")).toBeNull();
      break;
    }
    case "getPublishedLevelSnapshot": {
      // Plain published-content reader (no session): unknown level → null,
      // published level → snapshot (server-internal, may carry answers).
      const read = query as unknown as (id: string) => Promise<unknown>;
      expect(await read("no-such-level")).toBeNull();
      const published = await read(levelOneId);
      expect(published).not.toBeNull();
      break;
    }
    case "stripStudentPayload": {
      // Pure helper: every answer-bearing key is removed before a payload
      // may reach a student client.
      const strip = query as unknown as (t: string, p: unknown) => unknown;
      const stripped = strip("SEQUENCING", {
        prompt: { en: "Sort" },
        items: [],
        correctOrder: ["a"],
        correctOptionId: "a",
        solution: "SECRET",
      }) as Record<string, unknown>;
      expect(stripped["correctOrder"]).toBeUndefined();
      expect(stripped["correctOptionId"]).toBeUndefined();
      expect(stripped["solution"]).toBeUndefined();
      expect(stripped["prompt"]).toEqual({ en: "Sort" });
      break;
    }
    default: {
      // Unknown registry key: still deep-scan for leakage, then fail so the
      // author of the new query must add explicit assertions above.
      const result = await query(ctxA);
      expectNoForeignIds(result, name);
      expect.fail(
        `Tenant query "${name}" (${entry.modulePath}) has no explicit isolation assertions — ` +
          `add a case for it in tenant-isolation.test.ts`,
      );
    }
  }
}

describe("tenant isolation — registered queries", () => {
  it("discovers at least one tenantScopedQueries registry", () => {
    expect(registryEntries.length).toBeGreaterThan(0);
  });

  for (const entry of registryEntries) {
    it(`${entry.name} [${entry.modulePath}] never exposes school B data to school A`, async () => {
      await assertQueryIsolated(entry);
    });
  }
});

describe("tenant isolation — registry completeness", () => {
  for (const [modulePath, mod] of Object.entries(queryModules)) {
    it(`${modulePath} registers every exported query`, () => {
      const registry = mod["tenantScopedQueries"];
      if (!registry || typeof registry !== "object") {
        expect.fail(
          `${modulePath} must export a tenantScopedQueries registry (hard rule 1)`,
        );
      }
      const registered = registry as Record<string, unknown>;
      for (const [exportName, value] of Object.entries(mod)) {
        if (typeof value !== "function") continue;
        if (exportName.startsWith("_")) continue; // helper convention
        expect(
          registered[exportName],
          `exported query "${exportName}" in ${modulePath} is missing from its tenantScopedQueries registry`,
        ).toBe(value);
      }
    });
  }
});

describe("platform queries", () => {
  it("platform admin sees both schools (cross-tenant scope is intentional)", async () => {
    const overview = await getPlatformOverview(nitaqCtx);
    expect(overview.schools).toBeGreaterThanOrEqual(2);
    const schools = await listSchools(nitaqCtx);
    const ids = schools.map((s) => s.id);
    expect(ids).toContain(A.school.id);
    expect(ids).toContain(B.school.id);
  });

  it("school admin is rejected by the platform guard", async () => {
    await expect(getPlatformOverview(ctxA)).rejects.toThrow();
    await expect(listSchools(ctxA)).rejects.toThrow();
  });
});
