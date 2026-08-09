import { describe, expect, it } from "vitest";
import {
  blockCodingPayload,
  hintsSchema,
  programFixtureSchema,
  validatePayload,
  worldFixtureSchema,
  type LevelFixture,
  type WorldFixture,
} from "@/modules/curriculum/schemas";
import { bundle } from "../../content";

/**
 * The shipped Worlds 1–2 content is executable test fixture: every world must
 * survive the fixture schemas, every payload must survive validatePayload, and
 * the hand-authored Blockly solutions must only use blocks their level's
 * toolbox actually offers. (Solution *runs* are re-verified by the M3 engine
 * gate — structure is what M2 pins down.)
 */

// Canonical custom-block registry (m2 contract adjudication).
const KNOWN_BLOCKS = new Set([
  "bb_whenStart",
  "bb_moveForward",
  "bb_turnLeft",
  "bb_turnRight",
  "bb_repeat",
  "bb_repeatUntilGoal",
  "bb_if",
  "bb_ifElse",
  "bb_say",
  "bb_pathAhead",
]);

const MULTI_VARIANT_SLUGS = ["choose-the-path", "hidden-carrot", "forest-challenge"];

const playableWorlds = bundle.worlds.filter((w) => !w.horizon);
const horizonWorlds = bundle.worlds.filter((w) => w.horizon);

function allLevels(world: WorldFixture): LevelFixture[] {
  return world.modules.flatMap((m) => m.levels);
}

/** Depth-first collect of every `type` string in a Blockly workspace JSON. */
function collectBlockTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectBlockTypes(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (typeof record.type === "string") out.add(record.type);
    for (const value of Object.values(record)) collectBlockTypes(value, out);
  }
}

describe("content bundle shape", () => {
  it("contains the two playable worlds and six horizon worlds", () => {
    expect(playableWorlds.map((w) => w.slug)).toEqual(["bunny-meadow", "logic-forest"]);
    expect(horizonWorlds.map((w) => w.slug)).toEqual([
      "robot-lab",
      "data-desert",
      "ai-island",
      "ml-lab",
      "code-city",
      "inventor-island",
    ]);
  });

  it("every world passes worldFixtureSchema", () => {
    for (const world of bundle.worlds) {
      const parsed = worldFixtureSchema.safeParse(world);
      expect(
        parsed.success,
        `world ${world.slug}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`,
      ).toBe(true);
    }
  });

  it("every program passes programFixtureSchema and references bundled worlds in order", () => {
    const worldSlugs = bundle.worlds.map((w) => w.slug);
    for (const program of bundle.programs) {
      const parsed = programFixtureSchema.safeParse(program);
      expect(
        parsed.success,
        `program ${program.slug}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`,
      ).toBe(true);
      for (const slug of program.worlds) {
        expect(worldSlugs, `program ${program.slug} references ${slug}`).toContain(slug);
      }
    }
    expect(bundle.programs.map((p) => p.slug)).toEqual(["foundations"]);
    expect(bundle.programs[0]?.worlds.slice(0, 2)).toEqual(["bunny-meadow", "logic-forest"]);
  });

  it("slugs are unique (worlds globally; modules and levels per world)", () => {
    const worldSlugs = bundle.worlds.map((w) => w.slug);
    expect(new Set(worldSlugs).size).toBe(worldSlugs.length);

    for (const world of bundle.worlds) {
      const moduleSlugs = world.modules.map((m) => m.slug);
      expect(new Set(moduleSlugs).size, `modules of ${world.slug}`).toBe(moduleSlugs.length);
      const levelSlugs = allLevels(world).map((l) => l.slug);
      expect(new Set(levelSlugs).size, `levels of ${world.slug}`).toBe(levelSlugs.length);
    }
  });

  it("horizon worlds carry no modules; playable worlds carry the 10 seed levels", () => {
    for (const world of horizonWorlds) {
      expect(world.modules, `horizon ${world.slug}`).toHaveLength(0);
    }
    const levelCount = playableWorlds.reduce((n, w) => n + allLevels(w).length, 0);
    expect(levelCount).toBe(10);
  });
});

describe("level payloads and hints", () => {
  const levels = playableWorlds.flatMap((world) =>
    allLevels(world).map((level) => ({ world, level })),
  );

  it("every level payload passes validatePayload for its activity type", () => {
    for (const { world, level } of levels) {
      const result = validatePayload(level.activityType, level.payload);
      expect(
        result.ok,
        `${world.slug}/${level.slug}: ${result.ok ? "" : result.issues.join("; ")}`,
      ).toBe(true);
    }
  });

  it("every level carries exactly 4 hint tiers (1-4) with real EN copy", () => {
    for (const { world, level } of levels) {
      const parsed = hintsSchema.safeParse(level.hints);
      expect(parsed.success, `${world.slug}/${level.slug} hints`).toBe(true);
      const tiers = level.hints.map((h) => h.tier).sort((a, b) => a - b);
      expect(tiers, `${world.slug}/${level.slug} tiers`).toEqual([1, 2, 3, 4]);
      for (const hint of level.hints) {
        expect(hint.text.en.length, `${world.slug}/${level.slug} tier ${hint.tier}`).toBeGreaterThan(
          10,
        );
      }
    }
  });

  it("BLOCK_CODING levels declare a 3-star block budget, a solution, and a core check", () => {
    for (const { world, level } of levels) {
      if (level.activityType !== "BLOCK_CODING") continue;
      const payload = blockCodingPayload.parse(level.payload);
      expect(
        payload.starCriteria.threeStarMaxBlocks,
        `${world.slug}/${level.slug} star budget`,
      ).toBeGreaterThan(0);
      expect(payload.solution, `${world.slug}/${level.slug} solution`).toBeDefined();
      expect(
        payload.checks.some((c) => c.severity === "core"),
        `${world.slug}/${level.slug} core check`,
      ).toBe(true);
      // Worlds 1-2 adjudications: auto-collect on, bumps fatal.
      expect(payload.autoCollect, `${world.slug}/${level.slug} autoCollect`).toBe(true);
      expect(payload.nonFatalBumps, `${world.slug}/${level.slug} nonFatalBumps`).toBe(false);
    }
  });

  it("solutions and usedBlock checks only reference blocks the toolbox offers", () => {
    for (const { world, level } of levels) {
      if (level.activityType !== "BLOCK_CODING") continue;
      const payload = blockCodingPayload.parse(level.payload);
      const toolboxTypes = new Set(payload.toolbox.map((b) => b.type));

      for (const type of toolboxTypes) {
        expect(KNOWN_BLOCKS.has(type), `${world.slug}/${level.slug} unknown block ${type}`).toBe(
          true,
        );
      }

      const solutionTypes = new Set<string>();
      collectBlockTypes(payload.solution, solutionTypes);
      solutionTypes.delete("bb_whenStart"); // locked hat, never in a toolbox
      for (const type of solutionTypes) {
        expect(
          toolboxTypes.has(type),
          `${world.slug}/${level.slug} solution uses ${type} missing from toolbox`,
        ).toBe(true);
      }

      for (const check of payload.checks) {
        if (check.id !== "usedBlock" && check.id !== "notUsedBlock") continue;
        const block = check.params?.block;
        expect(typeof block, `${world.slug}/${level.slug} ${check.id} params.block`).toBe("string");
        if (check.id === "usedBlock") {
          expect(
            toolboxTypes.has(block as string),
            `${world.slug}/${level.slug} usedBlock ${String(block)} missing from toolbox`,
          ).toBe(true);
        }
      }
    }
  });

  it("levels 8-10 use 2-3 grid variants so If / Repeat-Until stay honest", () => {
    const forest = playableWorlds.find((w) => w.slug === "logic-forest");
    expect(forest).toBeDefined();
    for (const slug of MULTI_VARIANT_SLUGS) {
      const level = allLevels(forest as WorldFixture).find((l) => l.slug === slug);
      expect(level, slug).toBeDefined();
      const payload = blockCodingPayload.parse((level as LevelFixture).payload);
      expect(payload.variants.length, `${slug} variants`).toBeGreaterThanOrEqual(2);
      expect(payload.variants.length, `${slug} variants`).toBeLessThanOrEqual(3);
    }
  });
});
