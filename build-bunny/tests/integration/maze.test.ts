import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { submitAttempt, type AttemptResponse } from "@/modules/grading/server/submit";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import { getPlayableLevel } from "@/modules/learning/server/play";
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
 * Build-your-own maze through the real attempts pipeline: the child's design
 * is validated server-side (an unwinnable maze is a FAIL the child can act
 * on), a good design + program is graded exactly like a puzzle, the author's
 * sample never reaches the student payload, and the stored attempt keeps the
 * design so a teacher can replay it on the child's own map.
 */

type Node = Record<string, unknown>;
function chain(...blocks: Node[]): Node {
  let next: Node | undefined;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = { ...blocks[i] };
    if (next) block["next"] = { block: next };
    next = block;
  }
  return next!;
}
const program = (first: Node) => ({
  blocks: {
    languageVersion: 0,
    blocks: [{ type: "bb_whenStart", id: "hat", next: { block: first } }],
  },
});

/** 5×4 board, two rocks required; the sample: rocks force a detour down and along. */
const MAZE_PAYLOAD = {
  kind: "MAZE",
  board: { width: 5, height: 4 },
  palette: ["#"],
  mustInclude: { obstacles: 2, carrots: 0 },
  toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnLeft" }, { type: "bb_turnRight" }, { type: "bb_repeat" }],
  starCriteria: { threeStarMaxBlocks: 6 },
  sample: {
    design: { rows: [".#...", "..#..", ".....", "....G"], start: { x: 0, y: 0, dir: "E" } },
    solution: program(
      chain(
        { type: "bb_turnRight", id: "t1" },
        { type: "bb_repeat", id: "r1", fields: { TIMES: 3 }, inputs: { DO: { block: { type: "bb_moveForward", id: "m1" } } } },
        { type: "bb_turnLeft", id: "t2" },
        { type: "bb_repeat", id: "r2", fields: { TIMES: 4 }, inputs: { DO: { block: { type: "bb_moveForward", id: "m2" } } } },
      ),
    ),
  },
};

/** The child's own design: rocks at (1,0) and (2,1); the same detour solves it. */
const DESIGN = { rows: [".#...", "..#..", ".....", "....G"], start: { x: 0, y: 0, dir: "E" as const } };
const SOLUTION = MAZE_PAYLOAD.sample.solution;
/** A straight-line program: bumps the rock at (1,0). */
const BUMPS = program(chain({ type: "bb_moveForward", id: "m1" }, { type: "bb_moveForward", id: "m2" }));

let ctx: SessionContext;
let levelId: string;

beforeAll(async () => {
  await wipeDatabase();
  const school = await createTestSchool("Maze");
  const program_ = await createTestProgram({ name: "Maze Program" });
  const world = await addWorldToProgram(program_.id, 1, { name: "Maze World" });
  const mod = await createTestModule(world.id, 1);
  const level = await createTestLevel(mod.id, 1, {
    title: "My First Maze",
    activityType: "CREATIVE_PROJECT",
    payload: MAZE_PAYLOAD,
  });
  levelId = level.id;
  await enableProgramForSchool(school.id, program_.id);
  const student = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "mazer1",
    displayName: "Mazer One",
    studentIdentifier: "MZ-1",
    grade: 5,
  });
  await recomputeUnlocks(student.userId);
  ctx = createCtx({ userId: student.userId, role: "STUDENT", schoolId: school.id });
});

describe("build-your-own maze", () => {
  it("never ships the author's sample to the student", async () => {
    const playable = await getPlayableLevel(ctx, levelId);
    expect(playable).not.toBeNull();
    const payload = playable!.payload as Record<string, unknown>;
    expect(payload.sample).toBeUndefined();
    expect(payload.board).toEqual({ width: 5, height: 4 });
  });

  it("rejects an attempt without a design", async () => {
    const result = await submitAttempt(ctx, levelId, {
      attemptRunId: randomUUID(),
      workspaceJson: SOLUTION,
    });
    expect(result.status).toBe(400);
  });

  it("fails an unwinnable design with feedback the child can act on", async () => {
    const walled = { rows: [".#.#.", "..##.", "...#.", "...#G"], start: { x: 0, y: 0, dir: "E" as const } };
    const result = await submitAttempt(ctx, levelId, {
      attemptRunId: randomUUID(),
      workspaceJson: SOLUTION,
      design: walled,
    });
    expect(result.status).toBe(200);
    const body = result.body as AttemptResponse;
    expect(body.verdict).toBe("FAIL");
    expect(body.feedback).toEqual({ code: "mazeInvalid", data: { issue: "unreachableGoal" } });
    expect(body.stars).toBe(0);
  });

  it("grades the program on the child's own design — located failure, then a 3-star pass", async () => {
    const bump = await submitAttempt(ctx, levelId, {
      attemptRunId: randomUUID(),
      workspaceJson: BUMPS,
      design: DESIGN,
    });
    expect(bump.status).toBe(200);
    expect((bump.body as AttemptResponse).verdict).toBe("FAIL");
    expect((bump.body as AttemptResponse).feedback?.code).toBe("bumped");

    const runId = randomUUID();
    const pass = await submitAttempt(ctx, levelId, {
      attemptRunId: runId,
      workspaceJson: SOLUTION,
      design: DESIGN,
    });
    expect(pass.status).toBe(200);
    const body = pass.body as AttemptResponse;
    expect(body.verdict).toBe("PASS");
    expect(body.stars).toBe(3);

    // The stored input is the pair: the program AND the map it ran on.
    const attempt = await db.activityAttempt.findUnique({
      where: { attemptRunId: runId },
      select: { workspaceJson: true, blockCount: true, generatedCode: true },
    });
    expect(attempt?.workspaceJson).toEqual({ workspaceJson: SOLUTION, design: DESIGN });
    expect(attempt?.blockCount).toBe(6);
    expect(attempt?.generatedCode).toContain("turnRight();");
  });
});
