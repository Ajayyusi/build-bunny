import { describe, expect, it } from "vitest";
import {
  blockCodingPayload,
  debuggingPayload,
  hintsSchema,
  programFixtureSchema,
  validatePayload,
  worldFixtureSchema,
  XP_BY_DIFFICULTY,
  type LevelFixture,
  type WorldFixture,
} from "@/modules/curriculum/schemas";
import {
  gateReachability,
  gateSolutionRuns,
} from "@/modules/curriculum/server/gates";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { bundle } from "../../content";

/**
 * The shipped Worlds 1–3 content is executable test fixture: every world must
 * survive the fixture schemas, every payload must survive validatePayload,
 * the hand-authored Blockly solutions must only use blocks their level's
 * toolbox offers — and, since the engine gates went live (M3 wave 3), every
 * recorded solution must actually PASS the real solutionRuns/reachability
 * gates with 3 stars, right here, without a database.
 */

// Canonical custom-block registry (m2/m3 contract adjudication).
const KNOWN_BLOCKS = new Set([
  "bb_whenStart",
  "bb_moveForward",
  "bb_turnLeft",
  "bb_turnRight",
  "bb_collect",
  "bb_repeat",
  "bb_repeatUntilGoal",
  "bb_if",
  "bb_ifElse",
  "bb_say",
  "bb_pathAhead",
]);

const FOREST_MULTI_VARIANT_SLUGS = ["choose-the-path", "hidden-carrot", "forest-challenge"];
const ROBOT_LAB_MULTI_VARIANT_SLUGS = ["sensor-check", "smart-turns", "lab-gauntlet"];

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
  it("contains the three playable worlds and five horizon worlds", () => {
    expect(playableWorlds.map((w) => w.slug)).toEqual([
      "bunny-meadow",
      "logic-forest",
      "robot-lab",
    ]);
    expect(horizonWorlds.map((w) => w.slug)).toEqual([
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

  it("horizon worlds carry no modules; playable worlds carry the 20 levels", () => {
    for (const world of horizonWorlds) {
      expect(world.modules, `horizon ${world.slug}`).toHaveLength(0);
    }
    // 15 grid levels (m3) + 2 m4 activity-engine levels: loop-detective
    // (CODE_PREDICTION, logic-forest) and sensor-sequence (SEQUENCING,
    // robot-lab) + 3 Learn steps (CONCEPT_CARDS), one per playable world:
    // learn-repeat (bunny-meadow), learn-if (logic-forest), learn-if-else
    // (robot-lab).
    const levelCount = playableWorlds.reduce((n, w) => n + allLevels(w).length, 0);
    expect(levelCount).toBe(20);
    const robotLab = playableWorlds.find((w) => w.slug === "robot-lab");
    expect(allLevels(robotLab as WorldFixture)).toHaveLength(7);
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

  it("every level has real, non-placeholder Arabic for every student-facing field (m5-contracts §1)", () => {
    // A cheap untranslated-placeholder detector: a populated `ar` field that
    // is byte-identical to its `en` counterpart means someone copy-pasted
    // English instead of translating, since MSA Arabic text can never be
    // identical to English prose.
    function checkField(
      label: string,
      value: { en: string; ar?: string } | undefined,
    ) {
      if (value === undefined) return; // optional field (e.g. story), skip
      expect(value.ar, `${label} missing Arabic`).toBeTruthy();
      expect((value.ar ?? "").trim().length, `${label} Arabic is empty`).toBeGreaterThan(0);
      expect(value.ar, `${label} Arabic is byte-identical to English`).not.toBe(value.en);
    }

    for (const { world, level } of levels) {
      const label = `${world.slug}/${level.slug}`;
      checkField(`${label}.title`, level.title);
      checkField(`${label}.story`, level.story);
      checkField(`${label}.objective`, level.objective);
      checkField(`${label}.instructions`, level.instructions);
      checkField(`${label}.explanation`, level.explanation);
      for (const hint of level.hints) {
        checkField(`${label}.hint[tier ${hint.tier}]`, hint.text);
      }
    }
  });

  it("grid levels declare a 3-star block budget, a solution, and a core check", () => {
    for (const { world, level } of levels) {
      if (level.activityType !== "BLOCK_CODING" && level.activityType !== "DEBUGGING") continue;
      const schema = level.activityType === "DEBUGGING" ? debuggingPayload : blockCodingPayload;
      const payload = schema.parse(level.payload);
      expect(
        payload.starCriteria.threeStarMaxBlocks,
        `${world.slug}/${level.slug} star budget`,
      ).toBeGreaterThan(0);
      expect(payload.solution, `${world.slug}/${level.slug} solution`).toBeDefined();
      expect(
        payload.checks.some((c) => c.severity === "core"),
        `${world.slug}/${level.slug} core check`,
      ).toBe(true);
      // Adjudications: Worlds 1–2 auto-collect ON; Robot Lab teaches the
      // explicit Collect block, so auto-collect is OFF for the whole world.
      expect(payload.autoCollect, `${world.slug}/${level.slug} autoCollect`).toBe(
        world.slug !== "robot-lab",
      );
      expect(payload.nonFatalBumps, `${world.slug}/${level.slug} nonFatalBumps`).toBe(false);
    }
  });

  it("solutions and usedBlock checks only reference blocks the toolbox offers", () => {
    for (const { world, level } of levels) {
      if (level.activityType !== "BLOCK_CODING" && level.activityType !== "DEBUGGING") continue;
      const schema = level.activityType === "DEBUGGING" ? debuggingPayload : blockCodingPayload;
      const payload = schema.parse(level.payload);
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
    for (const slug of FOREST_MULTI_VARIANT_SLUGS) {
      const level = allLevels(forest as WorldFixture).find((l) => l.slug === slug);
      expect(level, slug).toBeDefined();
      const payload = blockCodingPayload.parse((level as LevelFixture).payload);
      expect(payload.variants.length, `${slug} variants`).toBeGreaterThanOrEqual(2);
      expect(payload.variants.length, `${slug} variants`).toBeLessThanOrEqual(3);
    }
  });

  it("Robot Lab sensor/decision levels are multi-variant; broken-bot ships a broken program", () => {
    const lab = playableWorlds.find((w) => w.slug === "robot-lab");
    expect(lab).toBeDefined();
    for (const slug of ROBOT_LAB_MULTI_VARIANT_SLUGS) {
      const level = allLevels(lab as WorldFixture).find((l) => l.slug === slug);
      expect(level, slug).toBeDefined();
      const payload = blockCodingPayload.parse((level as LevelFixture).payload);
      expect(payload.variants.length, `${slug} variants`).toBe(2);
    }

    const brokenBot = allLevels(lab as WorldFixture).find((l) => l.slug === "broken-bot");
    expect(brokenBot?.activityType).toBe("DEBUGGING");
    const payload = debuggingPayload.parse((brokenBot as LevelFixture).payload);
    expect(payload.brokenWorkspace).toBeDefined();
    expect(payload.solution).toBeDefined();
    // The broken program must genuinely differ from the fix (two seeded bugs).
    expect(JSON.stringify(payload.brokenWorkspace)).not.toBe(
      JSON.stringify(payload.solution),
    );

    const capstone = allLevels(lab as WorldFixture).find((l) => l.slug === "lab-gauntlet");
    expect(capstone?.difficulty).toBe("HARD");
  });
});

describe("solutions survive the real publish gates (no DB needed)", () => {
  /** Minimal snapshot the gates need — text fields are irrelevant to them. */
  function snapshotOf(world: WorldFixture, level: LevelFixture): LevelSnapshot {
    return {
      levelId: `fixture-${level.slug}`,
      slug: level.slug,
      moduleId: "fixture-module",
      moduleSlug: "fixture-module",
      worldId: `fixture-${world.slug}`,
      worldSlug: world.slug,
      order: level.order,
      activityType: level.activityType,
      track: level.track,
      title: level.title,
      story: level.story ?? null,
      objective: level.objective,
      instructions: level.instructions,
      explanation: level.explanation,
      teacherNotes: level.teacherNotes ?? null,
      difficulty: level.difficulty,
      recommendedGradeMin: level.recommendedGradeMin ?? null,
      recommendedGradeMax: level.recommendedGradeMax ?? null,
      estimatedMinutes: level.estimatedMinutes,
      xpReward: level.xpReward ?? XP_BY_DIFFICULTY[level.difficulty],
      maxStars: 3,
      tags: level.tags,
      payload: level.payload,
      hints: level.hints,
      arComplete: false,
    };
  }

  const gridLevels = playableWorlds.flatMap((world) =>
    allLevels(world)
      .filter((l) => l.activityType === "BLOCK_CODING" || l.activityType === "DEBUGGING")
      .map((level) => ({ world, level })),
  );

  it("every recorded solution PASSES all variants with 3 stars (hints ignored)", () => {
    for (const { world, level } of gridLevels) {
      const result = gateSolutionRuns(snapshotOf(world, level));
      expect(
        result.ok,
        `${world.slug}/${level.slug}: ${result.issues.join("; ")}`,
      ).toBe(true);
      expect(result.skipped, `${world.slug}/${level.slug} ran for real`).toBeUndefined();
    }
  });

  it("every variant's goal and collectables are reachable from the start", () => {
    for (const { world, level } of gridLevels) {
      const result = gateReachability(snapshotOf(world, level));
      expect(
        result.ok,
        `${world.slug}/${level.slug}: ${result.issues.join("; ")}`,
      ).toBe(true);
      expect(result.skipped, `${world.slug}/${level.slug} ran for real`).toBeUndefined();
    }
  });
});
