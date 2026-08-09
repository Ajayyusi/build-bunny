import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import { createStaff, createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  getPlatformOverview,
  listSchools,
} from "@/modules/schools/server/platform-queries";
import {
  createCtx,
  createTestSchool,
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
let nitaqCtx: SessionContext;

beforeAll(async () => {
  await wipeDatabase();
  A = await seedSchool("Alpha");
  B = await seedSchool("Beta");
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
