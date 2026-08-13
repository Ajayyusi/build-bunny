import { z } from "zod";

/**
 * Curriculum content contracts (plan §1.2 + adjudicated engine contract).
 * These schemas validate Level.payload / Level.hints at every boundary:
 * fixture import, publish gates, and the M3 engine's level loader. The
 * database is the source of truth; fixtures are an import format only.
 */

// ── Localized text: { en, ar?, arHash? } ─────────────────────────────────
// arHash is the hash of the EN text the Arabic was translated from — a
// mismatch means the translation is stale (translation dashboard, phase K2).
export const localizedText = z.object({
  en: z.string().min(1),
  ar: z.string().optional(),
  arHash: z.string().optional(),
});
export type LocalizedText = z.infer<typeof localizedText>;

export const localizedTextOptional = localizedText.optional();

/** Resolve a localized field for display with EN fallback. */
export function resolveText(
  value: LocalizedText | null | undefined,
  locale: string,
): string {
  if (!value) return "";
  if (locale === "ar" && value.ar) return value.ar;
  return value.en;
}

// ── Grading checks — canonical registry (coding-engine doc owns ids) ─────
export const CHECK_IDS = [
  "reachedGoal",
  "collectedAll",
  "avoidedTiles",
  "usedBlock",
  "notUsedBlock",
  "maxBlocks",
  "variableEquals",
  "expectedOutput",
  "expectedSequence",
  "classifierResult",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

// core = the goal itself (fail ⇒ FAIL) · secondary = required constraints
// (fail ⇒ PARTIAL) · quality = elegance, affects stars only (plan §1.2).
export const checkSchema = z.object({
  id: z.enum(CHECK_IDS),
  severity: z.enum(["core", "secondary", "quality"]),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type Check = z.infer<typeof checkSchema>;

export const starCriteriaSchema = z.object({
  /** Block count at or under which a passing run earns the 3rd star. */
  threeStarMaxBlocks: z.number().int().positive().optional(),
});

// ── Grid world (BLOCK_CODING / DEBUGGING) ────────────────────────────────
// Tile legend: "." empty · "#" rock (fatal bump, plan §1.1 B4) · "C" carrot
// (auto-collected in Worlds 1–2, B1) · "G" goal burrow · "W" water hazard.
const gridRow = z.string().regex(/^[.#CGW]+$/);

export const directionSchema = z.enum(["N", "E", "S", "W"]);

export const gridVariantSchema = z
  .object({
    rows: z.array(gridRow).min(2).max(10),
    start: z.object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      dir: directionSchema,
    }),
  })
  .superRefine((variant, ctx) => {
    const width = variant.rows[0]?.length ?? 0;
    if (!variant.rows.every((r) => r.length === width)) {
      ctx.addIssue({ code: "custom", message: "All grid rows must have equal width" });
    }
    if (variant.start.y >= variant.rows.length || variant.start.x >= width) {
      ctx.addIssue({ code: "custom", message: "Start position outside the grid" });
    }
  });

/** Toolbox entry: a Blockly block type, optionally instance-limited. */
export const blockRefSchema = z.object({
  type: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

const blockCodingCore = z.object({
  toolbox: z.array(blockRefSchema).min(1),
  /**
   * Multi-variant maps (plan §1.1 B3): ONE program must pass ALL variants —
   * what makes If / Repeat-Until honest instead of memorizable.
   */
  variants: z.array(gridVariantSchema).min(1).max(4),
  /** Worlds 1–2 collect on tile entry; bb_collect debuts in Robot Lab. */
  autoCollect: z.boolean().default(true),
  /** Default false: bumping a rock ends the run as a located FAIL. */
  nonFatalBumps: z.boolean().default(false),
  budgets: z
    .object({ maxCommands: z.number().int().positive().max(10_000).default(1000) })
    .default({ maxCommands: 1000 }),
  checks: z.array(checkSchema).min(1),
  starCriteria: starCriteriaSchema.default({}),
  /** Blockly workspace JSON pre-loaded for the student (optional). */
  startWorkspace: z.unknown().optional(),
  /** Author's recorded solution — publish gates re-run it in M3+. */
  solution: z.unknown().optional(),
});

export const blockCodingPayload = blockCodingCore.superRefine((p, ctx) => {
  if (!p.checks.some((c) => c.severity === "core")) {
    ctx.addIssue({ code: "custom", message: "At least one core check is required" });
  }
});

/** DEBUGGING = the block-coding player pre-loaded with a broken program. */
export const debuggingPayload = blockCodingCore
  .extend({
    brokenWorkspace: z.unknown(),
  })
  .superRefine((p, ctx) => {
    if (!p.checks.some((c) => c.severity === "core")) {
      ctx.addIssue({ code: "custom", message: "At least one core check is required" });
    }
    if (p.brokenWorkspace === undefined || p.brokenWorkspace === null) {
      ctx.addIssue({ code: "custom", message: "brokenWorkspace is required" });
    }
  });

export const codePredictionPayload = z
  .object({
    /** The program students read (code is not localized). */
    code: z.string().min(1),
    language: z.literal("javascript").default("javascript"),
    prompt: localizedText,
    options: z
      .array(z.object({ id: z.string().min(1), text: localizedText }))
      .min(2)
      .max(5),
    // Stripped from student-facing payloads by the loader (answer-bearing).
    correctOptionId: z.string().min(1),
    wrongFeedback: localizedTextOptional,
  })
  .superRefine((p, ctx) => {
    if (!p.options.some((o) => o.id === p.correctOptionId)) {
      ctx.addIssue({ code: "custom", message: "correctOptionId must match an option" });
    }
    if (new Set(p.options.map((o) => o.id)).size !== p.options.length) {
      ctx.addIssue({ code: "custom", message: "Option ids must be unique" });
    }
  });

export const sequencingPayload = z
  .object({
    prompt: localizedText,
    items: z
      .array(z.object({ id: z.string().min(1), text: localizedText }))
      .min(3)
      .max(8),
    // Answer-bearing: stripped from student-facing payloads.
    correctOrder: z.array(z.string().min(1)),
  })
  .superRefine((p, ctx) => {
    const ids = new Set(p.items.map((i) => i.id));
    if (
      p.correctOrder.length !== p.items.length ||
      !p.correctOrder.every((id) => ids.has(id))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "correctOrder must be a permutation of item ids",
      });
    }
  });

// ── CONCEPT_CARDS: the Learn step (docs/build-bunny/LEARN-STEP-SPEC.md) ──

/**
 * Depth-first collect of every serialized Blockly `type` in a workspace JSON.
 * Local to this module rather than imported from modules/blockly: schemas.ts
 * is the neutral contract layer (no "use client", no "server-only", no
 * Blockly) and must stay importable from fixtures, client and server alike.
 */
function collectBlockTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectBlockTypes(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (typeof record["type"] === "string") out.add(record["type"]);
    for (const value of Object.values(record)) collectBlockTypes(value, out);
  }
}

/**
 * A Learn step: three beats on one trail node — watch a worked example run,
 * fill the single gap in a faded copy of it, then hand off to the puzzle that
 * needs the concept. Both beats run on the SAME grid simulation the puzzles
 * use (hence the grid fields mirroring blockCodingPayload rather than a
 * bespoke slideshow format): the concept is shown in the medium it will be
 * used in. This is the worked-example effect — for novices, studying a solved
 * example then completing a faded one beats solving from scratch.
 */
export const conceptCardsPayload = z
  .object({
    /** Concept taught ("loops", "conditionals") — the handle spaced review
     * levels and analytics select on. */
    conceptSlug: z.string().regex(/^[a-z0-9-]+$/),
    /**
     * The one grid both beats run on. Exactly one by design: a lesson
     * demonstrates a concept, it does not ask the student to generalise
     * across maps — that is what the multi-variant puzzles after it are for.
     */
    variants: z.array(gridVariantSchema).length(1),
    autoCollect: z.boolean().default(true),
    nonFatalBumps: z.boolean().default(false),
    budgets: z
      .object({ maxCommands: z.number().int().positive().max(10_000).default(1000) })
      .default({ maxCommands: 1000 }),
    /** Beat 1 — the solved program, played back read-only with the executing
     * block lit up. */
    workedExample: z.object({
      blocks: z.unknown(),
      caption: localizedText,
    }),
    /** Beat 2 — the same program with exactly one block taken out. */
    faded: z.object({
      blocks: z.unknown(),
      /** Blocks offered for the gap: the answer plus plausible distractors. */
      toolbox: z.array(blockRefSchema).min(1),
      caption: localizedText,
      // Answer-bearing: stripped from student-facing payloads.
      missingBlockType: z.string().min(1),
    }),
  })
  .superRefine((p, ctx) => {
    const missing = p.faded.missingBlockType;
    if (!p.faded.toolbox.some((entry) => entry.type === missing)) {
      ctx.addIssue({
        code: "custom",
        message: `faded.toolbox must offer the missing block "${missing}"`,
      });
    }
    const workedTypes = new Set<string>();
    collectBlockTypes(p.workedExample.blocks, workedTypes);
    if (!workedTypes.has(missing)) {
      ctx.addIssue({
        code: "custom",
        message: `workedExample must use "${missing}" — it is the block faded removes`,
      });
    }
    const fadedTypes = new Set<string>();
    collectBlockTypes(p.faded.blocks, fadedTypes);
    if (fadedTypes.has(missing)) {
      ctx.addIssue({
        code: "custom",
        message: `faded.blocks still contains "${missing}" — there is no gap to fill`,
      });
    }
  });

/**
 * One specimen a student can teach with, or the model is tested on. Two
 * continuous features only: the child has to be able to see the whole
 * feature space at once for the lesson to land, and two axes is the most
 * that fits on a screen honestly.
 */
export const specimenSchema = z
  .object({
    id: z.string().min(1),
    /** 0–1 on each axis; the player maps them to berry size and hue. */
    size: z.number().min(0).max(1),
    color: z.number().min(0).max(1),
  })
  .strict();


/**
 * How an AI level PRESENTS itself. None of this is answer-bearing — it all
 * ships to the student on purpose — and all of it is optional, so every
 * already-authored level renders byte-identically without it.
 *
 * It lives in the payload rather than in per-theme message namespaces for
 * two reasons. next-intl's t() THROWS on a missing key, so one un-translated
 * string would white-screen an entire world; and the content suite already
 * enforces Arabic completeness on payload fields, so copy that lives here is
 * covered by a test that copy in messages/*.json is not.
 */
const aiThemeSchema = z
  .object({
    /** Which glyph vocabulary — see src/modules/ai/glyph.ts. */
    glyph: z.enum(["berry", "grain", "cell", "blip"]).default("berry"),
    /** What the two measurements are CALLED in this world. */
    featureNames: z.object({ size: localizedText, color: localizedText }),
    /** The two outcomes, as a glyph a child reads before the words. */
    truthEmoji: z.object({
      positive: z.string().min(1).max(4),
      negative: z.string().min(1).max(4),
    }),
  })
  .strict();

/**
 * The explanation animation's script. Four beats maximum: the walkthrough is
 * what a child reads before they have any context, and a fifth beat is a
 * page of text with a picture on it.
 */
const aiWalkthroughSchema = z
  .array(z.object({ title: localizedText, body: localizedText }).strict())
  .min(3)
  .max(4);

/**
 * The feature board: every specimen plotted at its own coordinates, so the
 * child sees the space the machine actually works in instead of a wrapped
 * row of circles. Read-only — the dots are a second click target for the
 * assignment they can already make, never a drag surface.
 */
const aiBoardSchema = z
  .object({
    show: z.boolean().default(true),
    /**
     * Tint the whole space with what the model currently predicts. This is
     * computed client-side from the student's OWN examples with the shared
     * classifier, so it reveals nothing the student did not already teach it.
     */
    showBoundary: z.boolean().default(false),
    axisLabels: z.object({ x: localizedText, y: localizedText }),
  })
  .strict();

/**
 * The hidden rule a level is graded against.
 *
 * `threshold` — one feature decides, the other is a decoy. A student who only
 * varies the decoy trains a model that cannot generalise, and that failure is
 * the lesson rather than a bug.
 *
 * `box` — positive only INSIDE both ranges. There is no ruling feature and no
 * decoy: neither measurement alone explains the category, so a child cannot
 * win by finding "the one that matters" because there isn't one. This is the
 * only rule kind that can express "both things have to be true at once".
 *
 * A plain z.union, not z.discriminatedUnion: the threshold arm defaults its
 * own `kind`, so already-authored fixtures with no `kind` at all still parse.
 */
const classificationRule = z.union([
  z
    .object({
      kind: z.literal("threshold").default("threshold"),
      feature: z.enum(["size", "color"]),
      /** Positive when that feature is BELOW the threshold. */
      threshold: z.number().min(0).max(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("box"),
      /** Inclusive [lo, hi] on each axis; positive inside BOTH. */
      size: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      color: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    })
    .strict(),
]);
export type ClassificationRule = z.infer<typeof classificationRule>;

/** See `passRule` on aiClassificationPayload. Shared with the student mirror. */
const classificationPassRule = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("allCorrect") }).strict(),
    z
      .object({
        kind: z.literal("safetyFirst"),
        neverMisclassify: z.enum(["positive", "negative"]),
        maxOtherErrors: z.number().int().min(0).max(8),
      })
      .strict(),
  ])
  .default({ kind: "allCorrect" });
export type ClassificationPassRule = z.infer<typeof classificationPassRule>;

/**
 * AI_CLASSIFICATION — teach by example. The first activity in the product
 * where the student does something a programmer would not: they never write
 * a rule. They label specimens, the engine fits a 1-nearest-neighbour
 * classifier to exactly those labels, and the model is scored on a held-out
 * test set the student never sees the answers for. Succeeding is therefore
 * about CHOOSING REPRESENTATIVE EXAMPLES, which is the real skill.
 *
 * Nothing in the student payload is answer-bearing by construction: the pool
 * ships unlabelled because the STUDENT supplies those labels, and the test
 * specimens ship unlabelled because the MODEL supplies those. The ground
 * truth lives only in `rule`, which stripStudentPayload removes.
 */
export const aiClassificationPayload = z
  .object({
    conceptSlug: z.string().regex(/^[a-z0-9-]+$/),
    /** Localized bucket names, e.g. Safe to eat / Not safe. */
    labels: z.object({ positive: localizedText, negative: localizedText }),
    /**
     * The bunny's past experience: specimens it has ALREADY tried, each
     * showing what happened. This is the training data, and it ships to the
     * student on purpose — a child cannot invent which berries are safe, and
     * being asked to would make the activity a guessing game. The real task
     * is choosing WHICH of these to teach with.
     */
    pool: z.array(specimenSchema.extend({ truth: z.enum(["positive", "negative"]) })).min(4),
    /** Held-out specimens the trained model must classify correctly. */
    testSet: z.array(specimenSchema).min(2),
    /** Ground truth. Server-held — see stripStudentPayload. */
    rule: classificationRule,
    /**
     * Pool specimens whose recorded `truth` is DELIBERATELY wrong.
     *
     * One level is about exactly this: another rabbit kept the notes and got
     * an entry wrong, the machine believes whatever label you hand it, and
     * the winning move is to leave that record out. Declaring the lie makes
     * it auditable — the content suite checks that each declared specimen
     * really does contradict the rule, and that every UNdeclared one agrees
     * with it, so a genuine authoring typo can never hide behind "it must
     * have been intentional".
     *
     * Answer-bearing: this names the berry. Swept by ANSWER_KEYS, and absent
     * from the .strict() student schema so a strip regression throws.
     */
    mislabelled: z.array(z.string()).default([]),
    /** Refuse to grade until the student has taught both buckets. */
    minPerLabel: z.number().int().min(1).default(2),
    /**
     * Hard cap on examples. Levels whose lesson is WHICH examples to pick
     * need one, because otherwise "teach the whole pool" wins without the
     * student ever choosing anything.
     */
    maxExamples: z.number().int().min(2).max(64).optional(),
    theme: aiThemeSchema.optional(),
    walkthrough: aiWalkthroughSchema.optional(),
    board: aiBoardSchema.optional(),
    /**
     * Student-designed hold-out (ml-lab/keep-some-back). A rule of the game,
     * so it ships: the player refuses to grade until at least `min` pool
     * specimens sit in the "keep for testing" pile, and the grader excludes
     * them from training. Without a third destination there is no way for a
     * child to physically enact "I am not allowed to train on this".
     */
    holdout: z.object({ min: z.number().int().min(2).max(8) }).strict().optional(),
    /**
     * What counts as passing. `allCorrect` is the default so nothing already
     * authored moves. `safetyFirst` makes mistake DIRECTION matter: calling
     * a `neverMisclassify` specimen the other thing fails outright, while up
     * to `maxOtherErrors` mistakes the cheap way round are tolerated. Ships
     * to the student — an objective the child cannot see is not an
     * objective, it is a trap.
     */
    passRule: classificationPassRule,
    /** 3-star budget lives in threeStarMaxBlocks — here, examples used. */
    starCriteria: starCriteriaSchema.default({}),
  })
  .strict();

/**
 * The same payload MINUS every answer-bearing field, which is exactly what a
 * student's browser is allowed to receive.
 *
 * It exists because the play page rebuilt this one payload with a TypeScript
 * `as` cast while every other activity type re-parsed against a mirror
 * schema. A cast cannot fail closed: if stripStudentPayload ever stopped
 * removing `rule`, the ground truth would be serialised into the page source
 * and no test would notice. Being `.strict()`, this turns that regression
 * into a loud 500 instead of a silent leak.
 */
export const aiClassificationStudentPayload = z
  .object({
    conceptSlug: z.string().regex(/^[a-z0-9-]+$/),
    labels: z.object({ positive: localizedText, negative: localizedText }),
    pool: z.array(specimenSchema.extend({ truth: z.enum(["positive", "negative"]) })).min(4),
    testSet: z.array(specimenSchema).min(2),
    minPerLabel: z.number().int().min(1).default(2),
    /** Ships on purpose: a cap the student cannot see is an unfair rule. */
    maxExamples: z.number().int().min(2).max(64).optional(),
    theme: aiThemeSchema.optional(),
    walkthrough: aiWalkthroughSchema.optional(),
    board: aiBoardSchema.optional(),
    holdout: z.object({ min: z.number().int().min(2).max(8) }).strict().optional(),
    passRule: classificationPassRule,
    starCriteria: starCriteriaSchema.default({}),
    // `rule` is deliberately absent, and .strict() is what enforces that.
  })
  .strict();


/**
 * PATTERN_RECOGNITION — "the Grouping Machine" (Data Desert / ML Lab).
 *
 * The one activity family where the data has NO labels anywhere: not on
 * screen, not in the payload, not on the server. The student places flags
 * (markers) in the feature space; every specimen belongs to its nearest
 * flag; the grade is a geometric quantity (tightness) the player shows live
 * from the same shared implementation the grader replays.
 *
 * Everything secret lives under ONE key, `groundTruth`, which
 * stripStudentPayload sweeps by name — the reference placement the publish
 * gate checks, and the hidden kind names revealed only in the PASS summary.
 */
export const patternRecognitionPayload = z
  .object({
    conceptSlug: z.string().regex(/^[a-z0-9-]+$/),
    theme: aiThemeSchema.optional(),
    walkthrough: aiWalkthroughSchema.optional(),
    /** Unlabelled by construction: specimenSchema has no truth field. */
    specimens: z.array(specimenSchema).min(6).max(20),
    /** How many flags the student may place. */
    markers: z
      .object({
        min: z.number().int().min(1).max(6),
        max: z.number().int().min(1).max(6),
      })
      .strict()
      .refine((m) => m.min <= m.max, { message: "markers.min must be <= markers.max" }),
    /** Readings the student may strike out ("not an animal"). */
    maxExclusions: z.number().int().min(0).max(2).default(0),
    /** Pass bar on the tightness score, computed over the KEPT specimens. */
    objective: z.object({ minTightness: z.number().min(0).max(1) }).strict(),
    /**
     * When present, the submitted markers are a SEED: the grader replays
     * this many Lloyd iterations before scoring, and the player animates the
     * identical steps. Deterministic on purpose — shared code, fixed
     * tie-breaks, no randomness anywhere in either half.
     */
    training: z
      .object({
        kind: z.literal("lloyd"),
        iterations: z.number().int().min(1).max(12),
      })
      .strict()
      .optional(),
    groundTruth: z
      .object({
        /** A placement the author asserts passes; the publish gate proves it. */
        referencePlacement: z
          .array(z.object({ size: z.number(), color: z.number() }).strict())
          .min(1),
        /** specimen id -> index into kindNames. Revealed on PASS only. */
        hiddenKinds: z.record(z.string(), z.number().int().min(0)).optional(),
        kindNames: z.array(localizedText).optional(),
      })
      .strict(),
    starCriteria: starCriteriaSchema.default({}),
  })
  .strict();

/** Answer-free mirror, .parse'd at the play page — same contract as the others. */
export const patternRecognitionStudentPayload = z
  .object({
    conceptSlug: z.string().regex(/^[a-z0-9-]+$/),
    theme: aiThemeSchema.optional(),
    walkthrough: aiWalkthroughSchema.optional(),
    specimens: z.array(specimenSchema).min(6).max(20),
    markers: z
      .object({
        min: z.number().int().min(1).max(6),
        max: z.number().int().min(1).max(6),
      })
      .strict(),
    maxExclusions: z.number().int().min(0).max(2).default(0),
    objective: z.object({ minTightness: z.number().min(0).max(1) }).strict(),
    training: z
      .object({
        kind: z.literal("lloyd"),
        iterations: z.number().int().min(1).max(12),
      })
      .strict()
      .optional(),
    starCriteria: starCriteriaSchema.default({}),
    // `groundTruth` is deliberately absent; .strict() enforces it.
  })
  .strict();

/** V1 activity types with a real engine behind them (plan §0.1-7). */
export const V1_ACTIVITY_TYPES = [
  "AI_CLASSIFICATION",
  "PATTERN_RECOGNITION",
  "BLOCK_CODING",
  "CODE_PREDICTION",
  "CONCEPT_CARDS",
  "DEBUGGING",
  "SEQUENCING",
] as const;
export type V1ActivityType = (typeof V1_ACTIVITY_TYPES)[number];

const PAYLOAD_SCHEMAS: Record<V1ActivityType, z.ZodTypeAny> = {
  AI_CLASSIFICATION: aiClassificationPayload,
  PATTERN_RECOGNITION: patternRecognitionPayload,
  BLOCK_CODING: blockCodingPayload,
  CODE_PREDICTION: codePredictionPayload,
  CONCEPT_CARDS: conceptCardsPayload,
  DEBUGGING: debuggingPayload,
  SEQUENCING: sequencingPayload,
};

export function validatePayload(
  activityType: string,
  payload: unknown,
): { ok: true; data: unknown } | { ok: false; issues: string[] } {
  const schema = PAYLOAD_SCHEMAS[activityType as V1ActivityType];
  if (!schema) {
    return { ok: false, issues: [`No V1 payload schema for activity type ${activityType}`] };
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { ok: true, data: parsed.data };
}

// ── Hints: exactly 4 progressive tiers, server-held ──────────────────────
export const hintsSchema = z
  .array(
    z.object({
      tier: z.number().int().min(1).max(4),
      text: localizedText,
    }),
  )
  .length(4)
  .superRefine((hints, ctx) => {
    const tiers = hints.map((h) => h.tier).sort((a, b) => a - b);
    if (tiers.join(",") !== "1,2,3,4") {
      ctx.addIssue({ code: "custom", message: "Hints must cover tiers 1–4 exactly once" });
    }
  });

// ── Import fixture shapes (content/ files → import service) ──────────────
export const levelFixtureSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  order: z.number().int().min(1),
  activityType: z.enum(V1_ACTIVITY_TYPES),
  track: z.enum(["PROGRAMMING", "AI_CONCEPTS", "MACHINE_LEARNING"]).default("PROGRAMMING"),
  title: localizedText,
  story: localizedTextOptional,
  objective: localizedText,
  instructions: localizedText,
  explanation: localizedText,
  teacherNotes: localizedTextOptional,
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
  recommendedGradeMin: z.number().int().min(1).max(12).optional(),
  recommendedGradeMax: z.number().int().min(1).max(12).optional(),
  estimatedMinutes: z.number().int().min(1).max(60).default(5),
  xpReward: z.number().int().positive().optional(),
  /** Omitted → the activity type's default (see defaultMaxStars). */
  maxStars: z.number().int().min(0).max(3).optional(),
  tags: z.array(z.string()).default([]),
  payload: z.unknown(),
  hints: hintsSchema,
  /** Optional explicit prerequisite level slugs (same world). */
  requires: z.array(z.string()).default([]),
});

export const moduleFixtureSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  order: z.number().int().min(1),
  name: localizedText,
  description: localizedTextOptional,
  levels: z.array(levelFixtureSchema).min(1),
});

export const worldFixtureSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: localizedText,
  tagline: localizedTextOptional,
  theme: z.string().min(1),
  horizon: z.boolean().default(false),
  modules: z.array(moduleFixtureSchema).default([]),
});

export const programFixtureSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: localizedText,
  description: localizedTextOptional,
  gradeMin: z.number().int().min(1).max(12),
  gradeMax: z.number().int().min(1).max(12),
  /** Ordered world slugs composing this program. */
  worlds: z.array(z.string()).min(1),
});

export type LevelFixture = z.infer<typeof levelFixtureSchema>;
export type ModuleFixture = z.infer<typeof moduleFixtureSchema>;
export type WorldFixture = z.infer<typeof worldFixtureSchema>;
export type ProgramFixture = z.infer<typeof programFixtureSchema>;

/** Difficulty-derived XP defaults (plan §1.2); Level.xpReward overrides. */
export const XP_BY_DIFFICULTY: Record<"EASY" | "MEDIUM" | "HARD", number> = {
  EASY: 50,
  MEDIUM: 75,
  HARD: 100,
};

/**
 * Star budget for an activity type; Level.maxStars overrides. A Learn step
 * teaches rather than tests, so it carries no stars at all — stars are the
 * puzzle reward (LEARN-STEP-SPEC.md §Grading). The grading pipeline clamps
 * every run to the level's own maxStars, so a 0-star level awards none
 * without computeStars or the star criteria changing.
 */
export function defaultMaxStars(activityType: string): number {
  return activityType === "CONCEPT_CARDS" ? 0 : 3;
}
