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

/** V1 activity types with a real engine behind them (plan §0.1-7). */
export const V1_ACTIVITY_TYPES = [
  "BLOCK_CODING",
  "CODE_PREDICTION",
  "DEBUGGING",
  "SEQUENCING",
] as const;
export type V1ActivityType = (typeof V1_ACTIVITY_TYPES)[number];

const PAYLOAD_SCHEMAS: Record<V1ActivityType, z.ZodTypeAny> = {
  BLOCK_CODING: blockCodingPayload,
  CODE_PREDICTION: codePredictionPayload,
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
