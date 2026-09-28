import { beforeAll, describe, expect, it } from "vitest";

import { checkPixelRoundCore } from "@/modules/ai/lab/pixel-playground/check";
import { NotFoundError } from "@/modules/auth/server/guard";
import { createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { computeAdventureState } from "@/modules/learning/server/adventure";
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
 * See Like a Computer's "Check my guess" against real rows: the answer key
 * stays on the server, so each round's reveal comes from here — and only
 * for a child who can open the level.
 */

const widget = {
  widgetId: "pixel-playground",
  images: [
    { id: "carrot", src: "/ai-lab/carrot.svg", name: { en: "Carrot" }, clue: { en: "orange, pointing down" } },
    { id: "house", src: "/ai-lab/house.svg", name: { en: "House" } },
  ],
  resolutions: [64, 32, 16, 8],
  rounds: [{ id: "r1", imageId: "carrot", resolution: 16 }],
};

let kid: SessionContext;
let otherSchoolKid: SessionContext;
let openId: string;
let lockedId: string;

beforeAll(async () => {
  await wipeDatabase();
  const program = await createTestProgram({ name: "Pixels" });
  const world = await addWorldToProgram(program.id, 1, { name: "AI World" });
  const mod = await createTestModule(world.id, 1);
  const level = { activityType: "AI_SIM" as const, track: "AI_CONCEPTS" as const, payload: {
      widget,
      intro: { en: "Pixels" },
      honesty: { kind: "REAL", note: { en: "Real pixels." } },
    },
  };
  openId = (await createTestLevel(mod.id, 1, level)).id;
  lockedId = (await createTestLevel(mod.id, 2, level)).id;

  const make = async (label: string, enabled: boolean) => {
    const school = await createTestSchool(label);
    if (enabled) await enableProgramForSchool(school.id, program.id);
    const student = await createStudent(SYSTEM_ACTOR, {
      schoolId: school.id,
      schoolCode: school.code,
      username: `pix${label.toLowerCase()}`,
      displayName: `Pixel ${label}`,
      studentIdentifier: `PIX-${label}`,
      grade: 4,
    });
    const ctx = createCtx({ userId: student.userId, role: "STUDENT", schoolId: school.id });
    await computeAdventureState(ctx);
    return ctx;
  };
  kid = await make("A", true);
  otherSchoolKid = await make("B", false);
});

describe("Check my guess", () => {
  it("says only 'not yet' for a wrong guess with squares still to add", async () => {
    expect(await checkPixelRoundCore(kid, openId, { roundId: "r1", imageId: "house", resolution: 8 })).toEqual({
      correct: false,
      final: false,
      answer: null,
    });
  });

  it("reveals the picture and its clue once the round is settled", async () => {
    expect(await checkPixelRoundCore(kid, openId, { roundId: "r1", imageId: "carrot", resolution: 8 })).toEqual({
      correct: true,
      final: false,
      answer: { imageId: "carrot", clue: { en: "orange, pointing down" } },
    });
    expect(await checkPixelRoundCore(kid, openId, { roundId: "r1", imageId: "house", resolution: 16 })).toMatchObject({
      correct: false,
      final: true,
      answer: { imageId: "carrot" },
    });
  });

  it("refuses a level the child hasn't opened, another school's child, and made-up rounds", async () => {
    await expect(checkPixelRoundCore(kid, lockedId, { roundId: "r1", imageId: "carrot", resolution: 8 })).rejects.toThrow(NotFoundError);
    await expect(checkPixelRoundCore(otherSchoolKid, openId, { roundId: "r1", imageId: "carrot", resolution: 8 })).rejects.toThrow(NotFoundError);
    await expect(checkPixelRoundCore(kid, openId, { roundId: "r9", imageId: "carrot", resolution: 8 })).rejects.toThrow(NotFoundError);
    await expect(checkPixelRoundCore(kid, openId, { roundId: "r1", imageId: "carrot", resolution: 64 })).rejects.toThrow(NotFoundError);
  });
});
