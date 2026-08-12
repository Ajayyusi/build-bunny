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
  starCriteria: { threeStarMaxBlocks?: number };
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
  revealHintAction: RevealHintAction;
  saveDraftAction: SaveDraftAction;
}
