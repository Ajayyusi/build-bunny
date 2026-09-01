import { describe, expect, it } from "vitest";
import {
  aiClassificationPayload,
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
import { leastSquares } from "@/modules/ai/lab/math/leastSquares";
import { sumSquaredError } from "@/modules/ai/lab/math/sumSquaredError";
import { INTERCEPT_STEP_FRACTION } from "@/modules/ai/lab/trend-line/steps";
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
  it("contains the six playable worlds and two horizon worlds", () => {
    // Worlds graduate from horizon art to real content when their engine
    // lands: AI Island with AI_CLASSIFICATION, Data Desert and ML Lab with
    // PATTERN_RECOGNITION + the classifier's holdout/passRule extensions.
    expect(playableWorlds.map((w) => w.slug)).toEqual([
      "bunny-meadow",
      "logic-forest",
      "robot-lab",
      "ai-island",
      "data-desert",
      "ml-lab",
    ]);
    expect(horizonWorlds.map((w) => w.slug)).toEqual([
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

  it("horizon worlds carry no modules; playable worlds carry the 33 levels", () => {
    for (const world of horizonWorlds) {
      expect(world.modules, `horizon ${world.slug}`).toHaveLength(0);
    }
    // 15 grid levels (m3) + 2 m4 activity-engine levels: loop-detective
    // (CODE_PREDICTION, logic-forest) and sensor-sequence (SEQUENCING,
    // robot-lab) + 5 Learn steps (CONCEPT_CARDS), one per concept that
    // debuts a new block: learn-repeat (bunny-meadow); learn-loop-body,
    // learn-if and learn-repeat-until (logic-forest); learn-if-else
    // (robot-lab) + 4 AI_CLASSIFICATION levels in ai-island, the first
    // world with no program in it at all: berry-sorter (which examples),
    // draw-the-line (where the machine's rule comes from),
    // the-berry-that-lied (a wrong label poisons its own neighbourhood)
    // and nothing-rules-alone (neither measurement decides on its own)
    // + the 4 phase-G graft levels in the two OPEN concept modules:
    // see-like-a-computer (AI_SIM pixel-playground) and secret-keepers
    // (AI_ETHICS) in ai-island's seeing-and-secrets;
    // you-be-the-classifier (AI_SIM boundary-builder) and fortune-teller
    // (AI_SIM trend-line) in data-desert's lines-in-the-sand.
    const levelCount = playableWorlds.reduce((n, w) => n + allLevels(w).length, 0);
    expect(levelCount).toBe(37);
    const robotLab = playableWorlds.find((w) => w.slug === "robot-lab");
    expect(allLevels(robotLab as WorldFixture)).toHaveLength(7);
    const aiIsland = playableWorlds.find((w) => w.slug === "ai-island");
    expect(allLevels(aiIsland as WorldFixture)).toHaveLength(6);
    const dataDesert = playableWorlds.find((w) => w.slug === "data-desert");
    expect(allLevels(dataDesert as WorldFixture)).toHaveLength(6);
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

      // Student-facing copy that lives in the PAYLOAD rather than in the
      // level's own fields. AI levels carry their bucket names, their
      // measurement names, their axis captions and the whole walkthrough
      // script there — roughly a third of everything a child reads in those
      // worlds — and without this it would all be outside the only Arabic
      // coverage check the repo has.
      if (level.activityType === "AI_CLASSIFICATION") {
        const p = aiClassificationPayload.parse(level.payload);
        checkField(`${label}.labels.positive`, p.labels.positive);
        checkField(`${label}.labels.negative`, p.labels.negative);
        if (p.theme) {
          checkField(`${label}.theme.featureNames.size`, p.theme.featureNames.size);
          checkField(`${label}.theme.featureNames.color`, p.theme.featureNames.color);
        }
        if (p.board) {
          checkField(`${label}.board.axisLabels.x`, p.board.axisLabels.x);
          checkField(`${label}.board.axisLabels.y`, p.board.axisLabels.y);
        }
        p.walkthrough?.forEach((beat, i) => {
          checkField(`${label}.walkthrough[${i}].title`, beat.title);
          checkField(`${label}.walkthrough[${i}].body`, beat.body);
        });
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

describe("AI Lab trend-line levels are winnable with the keyboard", () => {
  /**
   * The grid worlds prove their solutions run (above). The AI_SIM widgets had
   * no equivalent proof, and one shipped that a keyboard user could not win.
   *
   * gradeTrendLine passes when childSSE <= optimumSSE * toleranceFactor. Hold
   * the slope at its optimum and write the intercept as b_opt + d; because the
   * least-squares residuals sum to zero, SSE(b_opt + d) = optimumSSE + n*d^2
   * exactly. So the passing intercepts are a band of half-width
   * sqrt(optimumSSE * (toleranceFactor - 1) / n) around the optimum — a closed
   * form, no search needed.
   *
   * One arrow press moves the intercept by INTERCEPT_STEP_FRACTION of the
   * plotted y-range. If that step is not comfortably smaller than the band,
   * the child hops over the answer forever. Four steps across is the floor:
   * fewer than that and there is no room to hunt.
   */
  const MIN_STEPS_ACROSS_BAND = 4;
  const BAND_MULTIPLIER = 1.5; // matches trend-line/grade.ts and the widget

  const trendLevels = playableWorlds.flatMap((world) =>
    allLevels(world)
      .filter(
        (level) =>
          level.activityType === "AI_SIM" &&
          (level.payload as { widget?: { widgetId?: string } }).widget?.widgetId === "trend-line",
      )
      .map((level) => ({ world, level })),
  );

  it("finds the shipped trend-line level(s)", () => {
    expect(trendLevels.length).toBeGreaterThan(0);
  });

  it("every trend-line level asks for a line that is worse than least squares", () => {
    for (const { world, level } of trendLevels) {
      const config = (level.payload as { widget: { toleranceFactor: number } }).widget;
      // toleranceFactor <= 1 would demand the child beat the optimum itself.
      expect(config.toleranceFactor, `${world.slug}/${level.slug}`).toBeGreaterThan(1);
    }
  });

  it("every trend-line level's passing band is several keyboard steps wide", () => {
    for (const { world, level } of trendLevels) {
      const config = (
        level.payload as {
          widget: {
            points: { x: number; y: number }[];
            predictAt: number;
            toleranceFactor: number;
          };
        }
      ).widget;
      const label = `${world.slug}/${level.slug}`;

      const optimum = leastSquares(config.points);
      const optimumSSE = sumSquaredError(config.points, optimum);
      const n = config.points.length;
      const bandWidth = 2 * Math.sqrt((optimumSSE * (config.toleranceFactor - 1)) / n);

      // The plotted y-range, derived exactly as TrendLine.tsx derives it.
      const residualStd = Math.sqrt(optimumSSE / n);
      const fitted = optimum.slope * config.predictAt + optimum.intercept;
      const ys = config.points
        .map((point) => point.y)
        .concat(fitted - BAND_MULTIPLIER * residualStd, fitted + BAND_MULTIPLIER * residualStd);
      const yLow = Math.min(...ys);
      const yHigh = Math.max(...ys);
      const yPad = Math.max((yHigh - yLow) * 0.15, 1);
      const yRange = yHigh + yPad - (yLow - yPad);

      const step = yRange * INTERCEPT_STEP_FRACTION;
      expect(
        bandWidth / step,
        `${label}: one arrow press moves ${step.toFixed(3)} but the passing band is only ${bandWidth.toFixed(3)} wide`,
      ).toBeGreaterThanOrEqual(MIN_STEPS_ACROSS_BAND);
    }
  });
});
