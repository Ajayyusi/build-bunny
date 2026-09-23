/**
 * Dev-only: provision a brand-new student with zero progress in the DEMO
 * school's Grade 3A, through the same createStudent path the admin console
 * uses. For first-run / onboarding QA and the e2e suite.
 *
 * Usage: npx tsx scripts/dev-new-student.ts <username> [password]
 * Prints one JSON line: { username, userId, className, firstLevelId, … }.
 * Refuses to run with NODE_ENV=production.
 */
import "dotenv/config";
import Module from "node:module";
import path from "node:path";

if (process.env.NODE_ENV === "production") {
  console.error("dev-new-student refuses to run in production");
  process.exit(1);
}

const internals = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const original = internals._resolveFilename;
internals._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") {
    return path.join(__dirname, "..", "prisma", "seed-data", "server-only-shim.cjs");
  }
  if (request === "@/modules/auth/server/session") {
    return path.join(__dirname, "..", "prisma", "seed-data", "session-shim.cjs");
  }
  return original.call(this, request, ...rest);
};

async function main() {
  const username = (process.argv[2] ?? "newkid").toLowerCase();
  const password = process.argv[3] ?? "hop-hop-2027";
  const { db } = await import("../src/lib/db");
  const { createStudent } = await import("../src/modules/auth/server/provisioning");

  const school = await db.school.findFirstOrThrow({ where: { code: "DEMO" } });
  const klass = await db.class.findFirstOrThrow({
    where: { schoolId: school.id, name: { contains: "3A" } },
  });
  const existing = await db.user.findUnique({ where: { username: `demo__${username}` } });
  if (existing) {
    // Start over: a first-run test needs a genuinely fresh child.
    await db.user.delete({ where: { id: existing.id } });
  }
  const created = await createStudent(
    { userId: "dev-script", role: "SUPER_ADMIN", schoolId: null } as never,
    {
      schoolId: school.id,
      schoolCode: school.code,
      username,
      displayName: "Test Kid",
      studentIdentifier: `DEV-${username}`,
      grade: 3,
      password,
    },
  );
  await db.classMembership.create({
    data: { schoolId: school.id, classId: klass.id, userId: created.userId, role: "STUDENT" },
  });
  // The first level of the school's programme, for tests that open a level
  // by URL before anything has unlocked it.
  const firstLevel = await db.level.findFirst({
    where: {
      status: "PUBLISHED",
      module: {
        order: 1,
        world: { horizon: false, programs: { some: { order: 1 } } },
      },
    },
    orderBy: { order: "asc" },
    select: { id: true, slug: true },
  });
  console.log(
    JSON.stringify({
      username: `demo__${username}`,
      userId: created.userId,
      className: klass.name,
      firstLevelId: firstLevel?.id ?? null,
      firstLevelSlug: firstLevel?.slug ?? null,
    }),
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
