import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import { CAREFUL_VERDICTS, evaluateAchievements } from "@/modules/grading/server/achievements";
import { aiEthicsPayload } from "@/modules/curriculum/schemas";
import { ACHIEVEMENTS } from "../../prisma/seed-data/achievements";
import {
  addWorldToProgram,
  createTestLevel,
  createTestModule,
  createTestProgram,
  createTestSchool,
  SYSTEM_ACTOR,
  wipeDatabase,
} from "../helpers/fixtures";

import { bundle } from "../../content";

/**
 * "Good experiment" badges: rewarded for testing, retrying and an honest
 * "not sure" — not for speed. Evaluated by the real evaluator, over real
 * rows, inside a transaction as submit does.
 */

let studentUserId: string;
let schoolId: string;
const aiLevels: string[] = [];
let ethicsId: string;

const evaluate = () => db.$transaction((tx) => evaluateAchievements(tx, { studentUserId, schoolId }));

beforeAll(async () => {
  await wipeDatabase();
  for (const def of ACHIEVEMENTS.filter((a) => ["curious-tester", "try-check-try-again", "honest-not-sure"].includes(a.slug))) {
    await db.achievement.create({
      data: { slug: def.slug, name: def.name, description: def.description, icon: def.icon, criteria: def.criteria as object, order: def.order },
    });
  }
  const school = await createTestSchool("Badges");
  schoolId = school.id;
  const s = await createStudent(SYSTEM_ACTOR, {
    schoolId,
    schoolCode: school.code,
    username: "badgekid",
    displayName: "Badge Kid",
    studentIdentifier: "B-1",
    grade: 5,
  });
  studentUserId = s.userId;
  const program = await createTestProgram({ name: "Badges" });
  const world = await addWorldToProgram(program.id, 1, { name: "AI" });
  const mod = await createTestModule(world.id, 1);
  for (let i = 1; i <= 3; i++) aiLevels.push((await createTestLevel(mod.id, i, { activityType: "AI_SIM", track: "AI_CONCEPTS" })).id);
  ethicsId = (await createTestLevel(mod.id, 4)).id;
  await db.level.update({ where: { id: ethicsId }, data: { activityType: "AI_ETHICS" } });
});

const attempt = (levelId: string, verdict: "PASS" | "FAIL", resultSummary: object = {}) =>
  db.activityAttempt.create({
    data: {
      attemptRunId: crypto.randomUUID(),
      schoolId,
      studentUserId,
      levelId,
      levelVersion: 1,
      engineVersion: "test",
      workspaceJson: {},
      generatedCode: "",
      resultSummary,
      verdict,
    },
  });

describe("good experiment badges", () => {
  it("Curious Tester: ten AI tests", async () => {
    for (let i = 0; i < 9; i++) await db.learningEvent.create({ data: { schoolId, studentUserId, type: "AI_TEST", levelId: aiLevels[0] } });
    expect((await evaluate()).map((a) => a.slug)).not.toContain("curious-tester");
    await db.learningEvent.create({ data: { schoolId, studentUserId, type: "AI_TEST", levelId: aiLevels[0] } });
    expect((await evaluate()).map((a) => a.slug)).toContain("curious-tester");
  });

  it("Try, Check, Try Again: three AI activities finished after a failed check", async () => {
    for (const [i, levelId] of aiLevels.entries()) {
      await attempt(levelId, "FAIL");
      await attempt(levelId, "PASS");
      await db.studentProgress.create({ data: { schoolId, studentUserId, levelId, status: "COMPLETED", stars: 2 } });
      const earned = (await evaluate()).map((a) => a.slug);
      expect(earned.includes("try-check-try-again"), `after ${i + 1}`).toBe(i === 2);
    }
  });

  it("Honest “Not Sure”: a careful verdict in an ethics story", async () => {
    await attempt(ethicsId, "PASS", { predictions: ["real"] });
    expect((await evaluate()).map((a) => a.slug)).not.toContain("honest-not-sure");
    await attempt(ethicsId, "PASS", { predictions: ["real", "not-enough"] });
    expect((await evaluate()).map((a) => a.slug)).toContain("honest-not-sure");
  });

  it("the careful verdicts are the ids the stories really use", () => {
    const ethics = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels)).filter((l) => l.activityType === "AI_ETHICS");
    const ids = new Set(ethics.flatMap((l) => aiEthicsPayload.parse(l.payload).scenes.flatMap((s) => s.predict?.options.map((o) => o.id) ?? [])));
    for (const careful of CAREFUL_VERDICTS) expect(ids.has(careful), careful).toBe(true);
  });
});
