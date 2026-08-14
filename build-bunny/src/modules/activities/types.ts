import type { Check, GridVariantSpec } from "@/engine";
import type { LocalizedText } from "@/modules/curriculum/schemas";

/**
 * The activity-engine registry contract (m4 task 4). Every V1 engine
 * (BLOCK_CODING/DEBUGGING today, CODE_PREDICTION, SEQUENCING) and every
 * future one (QUIZ, PATTERN_RECOGNITION, AI_CLASSIFICATION, REAL_ML,
 * AI_ETHICS — registered in the ActivityType enum, no engine yet) shares
 * this shape:
 *   - a lazy client player component (src/modules/activities/players/registry.tsx)
 *   - a server grader (src/modules/activities/server/registry.ts)
 *   - a student-payload stripper (curriculum's stripStudentPayload — every V1
 *     type strips the same answer-key set, so the registry reuses it rather
 *     than duplicating per-type logic)
 * This file holds the neutral types both sides depend on: no "use client",
 * no "server-only", safe to import from anywhere.
 */

// ── Common intro view-model (server page.tsx resolves text/locale once) ────

export interface ActivityNextLevel {
  id: string;
  locked: boolean;
}

/** Fields every activity type's player needs, regardless of engine. */
export interface ActivityIntro {
  levelId: string;
  activityType: string;
  title: string;
  story: string;
  objective: string;
  instructions: string;
  explanation: string;
  difficulty: string;
  estimatedMinutes: number;
  maxStars: number;
  starsBest: number;
  /** Hint tiers already revealed in earlier sessions. */
  hintsUsedTiers: number[];
  /** World theme string driving grid tile tinting (unused by non-grid types). */
  worldTheme: string;
  nextLevel: ActivityNextLevel | null;
}

// ── Per-type student-facing payloads (answer-free by construction) ────────

/** Grading-relevant, answer-free slice of a BLOCK_CODING/DEBUGGING payload. */
export interface GridActivityPayload {
  toolbox: { type: string; limit?: number }[];
  variants: GridVariantSpec[];
  autoCollect: boolean;
  nonFatalBumps: boolean;
  budgets: { maxCommands: number };
  checks: Check[];
  starCriteria: { threeStarMaxBlocks?: number };
  /** Workspace to load first: draft, else the reset workspace. */
  initialWorkspace: unknown;
  /** What Reset restores: startWorkspace (brokenWorkspace for DEBUGGING). */
  resetWorkspace: unknown;
}

export interface CodePredictionActivityPayload {
  code: string;
  prompt: LocalizedText;
  options: { id: string; text: LocalizedText }[];
  /** Authored wrong-answer copy; null falls back to a generic message. */
  wrongFeedback: LocalizedText | null;
}

/**
 * Answer-free CONCEPT_CARDS payload — the Learn step's two beats. The grid
 * fields are here because both beats run the SAME simulation the puzzles do;
 * `faded.missingBlockType` is deliberately absent, since the answer stays
 * server-side and the client asks the grader rather than deciding for itself.
 */
export interface LearnActivityPayload {
  conceptSlug: string;
  /** Exactly one — a lesson demonstrates, it does not generalise. */
  variants: GridVariantSpec[];
  autoCollect: boolean;
  nonFatalBumps: boolean;
  budgets: { maxCommands: number };
  workedExample: { blocks: unknown; caption: LocalizedText };
  faded: {
    blocks: unknown;
    toolbox: { type: string; limit?: number }[];
    caption: LocalizedText;
  };
}

export interface SequencingActivityPayload {
  prompt: LocalizedText;
  /**
   * Presentation order — already shuffled server-side, deterministically per
   * (levelId, studentUserId) so the same student sees the same starting
   * order on every visit while different students see different shuffles.
   */
  items: { id: string; text: LocalizedText }[];
}

// ── Grading result (server side; shared by every engine's grader) ─────────

export type ActivityVerdict = "PASS" | "PARTIAL" | "FAIL" | "ERROR";

export interface ActivityFeedback {
  code: string;
  data?: Record<string, unknown>;
}

export interface ActivityGradeResult {
  verdict: ActivityVerdict;
  /** Pre-hint-cap quality flag — true only drives the 3rd star. */
  qualityPassed: boolean;
  primaryFeedback: ActivityFeedback | null;
  /** Persisted into ActivityAttempt.generatedCode ("" for non-code engines). */
  generatedCode: string;
  /** Persisted into ActivityAttempt.blockCount (null for non-grid engines). */
  blockCount: number | null;
  /** Opaque, JSON-serializable detail merged into ActivityAttempt.resultSummary. */
  summary: Record<string, unknown>;
}

// ── Client-side plumbing shared by every player component ─────────────────

/** Minimal structural read of LocalizedText for runtime payloads. */
export function resolveLocalized(value: unknown, locale: string): string {
  if (!value || typeof value !== "object") return "";
  const text = value as { en?: unknown; ar?: unknown };
  const en = typeof text.en === "string" ? text.en : "";
  const ar = typeof text.ar === "string" ? text.ar : "";
  return locale === "ar" && ar ? ar : en;
}

/** Grading route response (m3/m4 pinned contract) — server is sole authority. */
export interface AttemptResponse {
  verdict: ActivityVerdict;
  stars: number;
  starsBest: number;
  xpAwarded: number;
  xpTotal: number;
  newAchievements: { slug: string; name: unknown; icon: string }[];
  unlockedLevelIds: string[];
  worldCompleted: { slug: string; name: unknown } | null;
  feedback: ActivityFeedback | null;
  gradeMismatch: boolean;
}

/** Loose structural ActionResult — accepts the guard module's richer union. */
export type PlayerActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message?: string };

export type RevealHintAction = (input: {
  levelId: string;
  tier: number;
}) => Promise<PlayerActionResult<{ tier: number; text: unknown }>>;

export type SaveDraftAction = (input: {
  levelId: string;
  workspaceJson: unknown;
}) => Promise<PlayerActionResult<unknown>>;

/** Uniform props every registered player component receives. */
/** Answer-free slice of an AI_CLASSIFICATION payload (ground-truth `rule` removed). */
export interface TeachActivityPayload {
  conceptSlug: string;
  labels: { positive: string; negative: string };
  /** Training data: what happened when the bunny already tried each one. */
  pool: { id: string; size: number; color: number; truth: "positive" | "negative" }[];
  testSet: { id: string; size: number; color: number }[];
  minPerLabel: number;
  /** Hard cap on examples, when the level sets one. */
  maxExamples?: number;
  /** Presentation, already resolved to the request locale. */
  theme?: {
    glyph: string;
    featureNames: { size: string; color: string };
    truthEmoji: { positive: string; negative: string };
  };
  /** Per-level walkthrough script; absent = the global berry copy. */
  walkthrough?: { title: string; body: string }[];
  board?: { show: boolean; showBoundary: boolean; axisLabels: { x: string; y: string } };
  /** Present = the level demands a student-designed test pile of >= min. */
  holdout?: { min: number };
  /** What counts as passing; safetyFirst weighs mistakes by direction. */
  passRule:
    | { kind: "allCorrect" }
    | { kind: "safetyFirst"; neverMisclassify: "positive" | "negative"; maxOtherErrors: number };
  starCriteria: { threeStarMaxBlocks?: number };
}

/** Answer-free slice of a PATTERN_RECOGNITION payload (`groundTruth` removed). */
export interface GroupActivityPayload {
  conceptSlug: string;
  /** Unlabelled on purpose — no truth field exists anywhere in this family. */
  specimens: { id: string; size: number; color: number }[];
  markers: { min: number; max: number };
  maxExclusions: number;
  objective: { minTightness: number };
  /** Present = the submission is a seed and the grader replays the loop. */
  training?: { kind: "lloyd"; iterations: number };
  theme?: {
    glyph: string;
    featureNames: { size: string; color: string };
    truthEmoji: { positive: string; negative: string };
  };
  /** Per-level walkthrough script, already resolved to the request locale. */
  walkthrough?: { title: string; body: string }[];
  starCriteria: { threeStarMaxBlocks?: number };
}

// ── AI Lab graft (phase G): AI_ETHICS + AI_SIM payloads ───────────────────

/** Branching privacy/ethics scenarios; the `safe` flag never reaches the client. */
export interface AiEthicsActivityPayload {
  prompt: LocalizedText;
  scenes: {
    id: string;
    text: LocalizedText;
    art?: string;
    choices: { id: string; text: LocalizedText; outcome: LocalizedText; next?: string }[];
  }[];
  takeaways: LocalizedText[];
}

/** AI_SIM: widget-specific config, opaque here — each widget owns its own shape. */
export interface AiSimActivityPayload {
  widget: { widgetId: string } & Record<string, unknown>;
  intro: LocalizedText;
  honesty: { kind: "REAL" | "SIMULATED"; note: LocalizedText };
  /** Animated explanation shown before the child touches the widget. */
  walkthrough?: { title: LocalizedText; body: LocalizedText }[];
}

/**
 * AI_ETHICS branching resolution, shared by the player (client) and the
 * grader (server) so what the child experiences and what gets graded can
 * never diverge: a chosen `next` wins when it names an existing scene;
 * otherwise the story falls through to the next scene in array order; a
 * choice with no match either way ends the story (checklist screen).
 */
export function resolveNextSceneIndex(
  scenes: { id: string }[],
  currentIndex: number,
  next: string | undefined,
): number {
  if (next) {
    const named = scenes.findIndex((scene) => scene.id === next);
    return named === -1 ? scenes.length : named;
  }
  return currentIndex + 1;
}

export interface ActivityPlayerProps {
  intro: ActivityIntro;
  /**
   * Type-specific payload (GridActivityPayload | CodePredictionActivityPayload |
   * SequencingActivityPayload). Typed `unknown` at the registry boundary
   * because the map is keyed by a runtime string; page.tsx builds the right
   * shape per branch, so each concrete player casts it back with a one-line
   * comment instead of threading a generic through the whole registry.
   */
  payload: unknown;
  /**
   * The student's saved in-progress work for this level, or null.
   *
   * Grid levels receive their draft pre-merged into the payload's
   * initialWorkspace; every other engine gets it here, because a child on a
   * school tablet that reloads mid-level should not lose twenty minutes of
   * bucket sorting. Shape is per-engine and untrusted: it is whatever that
   * player last saved, so each one validates it before use and falls back to
   * a blank start. Drafts never carry answers — the server clears them on a
   * full pass and they only ever hold the child's own choices.
   */
  draft: unknown;
  revealHintAction: RevealHintAction;
  saveDraftAction: SaveDraftAction;
}
