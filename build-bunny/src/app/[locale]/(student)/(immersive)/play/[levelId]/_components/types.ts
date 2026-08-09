import type { Check, GridVariantSpec } from "@/engine";

/**
 * Serializable view-model for the level player. The server page resolves all
 * authored copy per locale and strips answer-bearing fields; the client
 * components below only ever see this shape. Cross-agent server interfaces
 * (getPlayableLevel, revealHint, saveWorkspaceDraft — m3 pinned contracts)
 * stay isolated in page.tsx; the client receives the actions as typed props.
 */

/** Minimal structural view of LocalizedText for runtime payloads. */
export function resolveLocalized(value: unknown, locale: string): string {
  if (!value || typeof value !== "object") return "";
  const text = value as { en?: unknown; ar?: unknown };
  const en = typeof text.en === "string" ? text.en : "";
  const ar = typeof text.ar === "string" ? text.ar : "";
  return locale === "ar" && ar ? ar : en;
}

export interface PlayerFeedback {
  code: string;
  data?: Record<string, unknown>;
}

/** Grading route response (m3 pinned contract) — server is sole authority. */
export interface AttemptResponse {
  verdict: "PASS" | "PARTIAL" | "FAIL" | "ERROR";
  stars: number;
  starsBest: number;
  xpAwarded: number;
  xpTotal: number;
  newAchievements: { slug: string; name: unknown; icon: string }[];
  unlockedLevelIds: string[];
  worldCompleted: { slug: string; name: unknown } | null;
  feedback: PlayerFeedback | null;
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

/** Grading-relevant, answer-free slice of a BLOCK_CODING/DEBUGGING payload. */
export interface PlayerPayload {
  toolbox: { type: string; limit?: number }[];
  variants: GridVariantSpec[];
  autoCollect: boolean;
  nonFatalBumps: boolean;
  budgets: { maxCommands: number };
  checks: Check[];
  starCriteria: { threeStarMaxBlocks?: number };
}

export interface PlayerLevelVM {
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
  /** World theme string driving the simulation tile tint. */
  worldTheme: string;
  /** The level after this one on the trail, if any. */
  nextLevel: { id: string; locked: boolean } | null;
  payload: PlayerPayload;
  /** Workspace to load first: draft, else the reset workspace. */
  initialWorkspace: unknown;
  /** What Reset restores: startWorkspace (brokenWorkspace for DEBUGGING). */
  resetWorkspace: unknown;
}
